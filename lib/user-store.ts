import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, type AuthAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StoredUser = {
  userId: string;
  matricule: string;
  name: string;
  role: string;
  service: string;
  permissions: string[];
  passwordHash: string;
  status: "ACTIVE" | "SUSPENDED";
  totpSecretEncrypted?: string;
  totpPendingSecretEncrypted?: string;
  totpEnabled?: boolean;
  totpLastUsedStep?: number;
  totpLastVerifiedAt?: number;
  lastLoginAt?: number;
  recoveryCodeHashes?: string[];
};

const legacyFile = path.join(process.cwd(), "data", "demo-users.json");
const dataDirectory = process.env.POLICE_DATA_DIR
  || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "PoliceMali") : path.join(process.cwd(), "data"));
const file = path.join(dataDirectory, "demo-users.json");
const includeRecoveryCodes = { recoveryCodes: { select: { codeHash: true } } } as const;

function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DEMO_MODE is not true");
  }
}

function mapAccount(account: AuthAccount & { recoveryCodes: { codeHash: string }[] }): StoredUser {
  const permissions = Array.isArray(account.permissions)
    ? account.permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
  return {
    userId: account.userId,
    matricule: account.matricule,
    name: account.name,
    role: account.role,
    service: account.service,
    permissions,
    passwordHash: account.passwordHash,
    status: account.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
    ...(account.totpSecretEncrypted ? { totpSecretEncrypted: account.totpSecretEncrypted } : {}),
    ...(account.totpPendingSecretEncrypted ? { totpPendingSecretEncrypted: account.totpPendingSecretEncrypted } : {}),
    totpEnabled: account.totpEnabled,
    ...(account.totpLastUsedStep !== null ? { totpLastUsedStep: account.totpLastUsedStep } : {}),
    ...(account.totpLastVerifiedAt !== null ? { totpLastVerifiedAt: account.totpLastVerifiedAt.getTime() } : {}),
    ...(account.lastLoginAt !== null ? { lastLoginAt: account.lastLoginAt.getTime() } : {}),
    recoveryCodeHashes: account.recoveryCodes.map(code => code.codeHash),
  };
}

async function listDemoUsers(): Promise<StoredUser[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as StoredUser[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || file === legacyFile) throw error;
    try {
      return JSON.parse(await fs.readFile(legacyFile, "utf8")) as StoredUser[];
    } catch (legacyError) {
      if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw legacyError;
    }
  }
}

async function saveDemoUsers(users: StoredUser[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(temporaryFile, file);
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listStoredUsers(): Promise<StoredUser[]> {
  if (isDemoMode()) return listDemoUsers();
  requireDatabaseUrl();
  const accounts = await prisma.authAccount.findMany({ include: includeRecoveryCodes, orderBy: { createdAt: "asc" } });
  return accounts.map(mapAccount);
}

export async function createStoredUser(input: {
  matricule: string;
  name: string;
  role: string;
  service: string;
  permissions: string[];
  password: string;
}) {
  const matricule = input.matricule.trim().toUpperCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  if (isDemoMode()) {
    const users = await listDemoUsers();
    if (users.some(user => user.matricule === matricule)) throw new Error("MATRICULE_EXISTS");
    const user: StoredUser = {
      userId: `demo-${randomUUID()}`,
      matricule,
      name: input.name,
      role: input.role,
      service: input.service,
      permissions: input.permissions,
      passwordHash,
      status: "ACTIVE",
    };
    await saveDemoUsers([user, ...users]);
    return user;
  }

  requireDatabaseUrl();
  try {
    const account = await prisma.authAccount.create({
      data: {
        userId: randomUUID(),
        matricule,
        name: input.name,
        role: input.role,
        service: input.service,
        permissions: input.permissions,
        passwordHash,
        status: "ACTIVE",
      },
      include: includeRecoveryCodes,
    });
    return mapAccount(account);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("MATRICULE_EXISTS");
    throw error;
  }
}

export async function updateStoredUser(matricule: string, status: "ACTIVE" | "SUSPENDED") {
  const normalized = matricule.trim().toUpperCase();
  if (isDemoMode()) {
    const users = await listDemoUsers();
    if (!users.some(user => user.matricule === normalized)) throw new Error("USER_NOT_FOUND");
    await saveDemoUsers(users.map(user => user.matricule === normalized ? { ...user, status } : user));
    return;
  }
  requireDatabaseUrl();
  const result = await prisma.authAccount.updateMany({ where: { matricule: normalized }, data: { status } });
  if (result.count === 0) throw new Error("USER_NOT_FOUND");
}

export async function updateStoredUserPassword(matricule: string, password: string) {
  const normalized = matricule.trim().toUpperCase();
  const passwordHash = await bcrypt.hash(password, 12);
  if (isDemoMode()) {
    const users = await listDemoUsers();
    if (!users.some(user => user.matricule === normalized)) throw new Error("USER_NOT_FOUND");
    await saveDemoUsers(users.map(user => user.matricule === normalized ? { ...user, passwordHash } : user));
    return;
  }
  requireDatabaseUrl();
  const result = await prisma.authAccount.updateMany({ where: { matricule: normalized }, data: { passwordHash } });
  if (result.count === 0) throw new Error("USER_NOT_FOUND");
}

let demoTotpWriteQueue: Promise<void> = Promise.resolve();

function serializeDemoTotpWrite<T>(operation: () => Promise<T>) {
  const result = demoTotpWriteQueue.then(operation);
  demoTotpWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function recordStoredUserLogin(matricule: string) {
  const normalized = matricule.trim().toUpperCase();
  const lastLoginAt = Date.now();
  if (isDemoMode()) {
    return serializeDemoTotpWrite(async () => {
      const users = await listDemoUsers();
      const target = users.find(user => user.matricule === normalized && user.status === "ACTIVE");
      if (!target) throw new Error("USER_NOT_FOUND");
      await saveDemoUsers(users.map(user => user.matricule === normalized ? { ...user, lastLoginAt } : user));
    });
  }
  requireDatabaseUrl();
  return prisma.authAccount.updateMany({
    where: { matricule: normalized, status: "ACTIVE" },
    data: { lastLoginAt: new Date(lastLoginAt) },
  }).then(result => {
    if (result.count !== 1) throw new Error("USER_NOT_FOUND");
  });
}

type TotpUpdate = Partial<Pick<StoredUser,
  "totpSecretEncrypted" | "totpPendingSecretEncrypted" | "totpEnabled" | "totpLastUsedStep"
>>;

export function updateStoredUserTotp(matricule: string, update: TotpUpdate) {
  const normalized = matricule.trim().toUpperCase();
  if (isDemoMode()) {
    return serializeDemoTotpWrite(async () => {
      const users = await listDemoUsers();
      const target = users.find(user => user.matricule === normalized);
      if (!target) throw new Error("USER_NOT_FOUND");
      const updated = { ...target, ...update };
      await saveDemoUsers(users.map(user => user.matricule === normalized ? updated : user));
      return updated;
    });
  }
  requireDatabaseUrl();
  return prisma.authAccount.update({
    where: { matricule: normalized },
    data: update,
    include: includeRecoveryCodes,
  }).then(mapAccount).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("USER_NOT_FOUND");
    }
    throw error;
  });
}

export function recordStoredTotpStep(matricule: string, step: number) {
  const normalized = matricule.trim().toUpperCase();
  const verifiedAt = Date.now();
  if (isDemoMode()) {
    return serializeDemoTotpWrite(async () => {
      const users = await listDemoUsers();
      const target = users.find(user => user.matricule === normalized && user.totpEnabled === true);
      if (!target || step <= (target.totpLastUsedStep ?? -1)) return false;
      await saveDemoUsers(users.map(user => user.matricule === normalized
        ? { ...user, totpLastUsedStep: step, totpLastVerifiedAt: verifiedAt }
        : user));
      return true;
    });
  }
  requireDatabaseUrl();
  return prisma.authAccount.updateMany({
    where: {
      matricule: normalized,
      totpEnabled: true,
      OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }],
    },
    data: { totpLastUsedStep: step, totpLastVerifiedAt: new Date(verifiedAt) },
  }).then(result => result.count === 1);
}

export function enableStoredUserTotp(
  matricule: string,
  pendingSecret: string,
  step: number,
  recoveryCodeHashes: string[],
) {
  const normalized = matricule.trim().toUpperCase();
  if (isDemoMode()) {
    return serializeDemoTotpWrite(async () => {
      const users = await listDemoUsers();
      const target = users.find(user => user.matricule === normalized);
      if (!target
        || target.status !== "ACTIVE"
        || target.totpEnabled === true
        || target.totpPendingSecretEncrypted !== pendingSecret) return null;
      const updated: StoredUser = {
        ...target,
        totpSecretEncrypted: pendingSecret,
        totpPendingSecretEncrypted: undefined,
        totpEnabled: true,
        totpLastUsedStep: step,
        totpLastVerifiedAt: Date.now(),
        lastLoginAt: Date.now(),
        recoveryCodeHashes,
      };
      await saveDemoUsers(users.map(user => user.matricule === normalized ? updated : user));
      return updated;
    });
  }
  requireDatabaseUrl();
  return prisma.$transaction(async transaction => {
    const result = await transaction.authAccount.updateMany({
      where: {
        matricule: normalized,
        status: "ACTIVE",
        totpEnabled: false,
        totpPendingSecretEncrypted: pendingSecret,
      },
      data: {
        totpSecretEncrypted: pendingSecret,
        totpPendingSecretEncrypted: null,
        totpEnabled: true,
        totpLastUsedStep: step,
        totpLastVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
    if (result.count !== 1) return null;
    const account = await transaction.authAccount.findUnique({
      where: { matricule: normalized },
      select: { userId: true },
    });
    if (!account) throw new Error("USER_NOT_FOUND");
    await transaction.authRecoveryCode.createMany({
      data: recoveryCodeHashes.map(codeHash => ({ codeHash, accountUserId: account.userId })),
    });
    const updated = await transaction.authAccount.findUnique({
      where: { matricule: normalized },
      include: includeRecoveryCodes,
    });
    return updated ? mapAccount(updated) : null;
  });
}

export async function consumeStoredRecoveryCode(matricule: string, codeHash: string) {
  const normalized = matricule.trim().toUpperCase();
  if (isDemoMode()) {
    return serializeDemoTotpWrite(async () => {
      const users = await listDemoUsers();
      const target = users.find(user => user.matricule === normalized);
      if (!target) return false;
      const hashes = target.recoveryCodeHashes ?? [];
      const index = hashes.findIndex(hash => {
        const left = Buffer.from(hash);
        const right = Buffer.from(codeHash);
        return left.length === right.length && timingSafeEqual(left, right);
      });
      if (index < 0) return false;
      const recoveryCodeHashes = hashes.filter((_, hashIndex) => hashIndex !== index);
      await saveDemoUsers(users.map(user => user.matricule === normalized
        ? { ...user, recoveryCodeHashes, totpLastVerifiedAt: Date.now() }
        : user));
      return true;
    });
  }
  requireDatabaseUrl();
  return prisma.$transaction(async transaction => {
    const account = await transaction.authAccount.findUnique({
      where: { matricule: normalized },
      select: { userId: true, status: true },
    });
    if (!account || account.status !== "ACTIVE") return false;
    const result = await transaction.authRecoveryCode.deleteMany({
      where: { accountUserId: account.userId, codeHash },
    });
    if (result.count !== 1) return false;
    await transaction.authAccount.update({
      where: { userId: account.userId },
      data: { totpLastVerifiedAt: new Date() },
    });
    return true;
  });
}

export async function updateStoredUserProfile(input: {
  matricule: string;
  newMatricule: string;
  name: string;
  service: string;
  role: string;
  permissions: string[];
  password?: string;
}) {
  const currentMatricule = input.matricule.trim().toUpperCase();
  const newMatricule = input.newMatricule.trim().toUpperCase();
  if (isDemoMode()) {
    const users = await listDemoUsers();
    const target = users.find(user => user.matricule === currentMatricule);
    if (!target) throw new Error("USER_NOT_FOUND");
    if (users.some(user => user.matricule === newMatricule && user.matricule !== currentMatricule)) {
      throw new Error("MATRICULE_EXISTS");
    }
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : target.passwordHash;
    const next = users.map(user => user.matricule === currentMatricule ? {
      ...user,
      matricule: newMatricule,
      name: input.name.trim(),
      service: input.service.trim(),
      role: input.role,
      permissions: input.permissions,
      passwordHash,
    } : user);
    await saveDemoUsers(next);
    return next.find(user => user.matricule === newMatricule)!;
  }

  requireDatabaseUrl();
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  try {
    const account = await prisma.authAccount.update({
      where: { matricule: currentMatricule },
      data: {
        matricule: newMatricule,
        name: input.name.trim(),
        service: input.service.trim(),
        role: input.role,
        permissions: input.permissions,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: includeRecoveryCodes,
    });
    return mapAccount(account);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("MATRICULE_EXISTS");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("USER_NOT_FOUND");
    }
    throw error;
  }
}

export async function deleteStoredUser(matricule: string) {
  const normalized = matricule.trim().toUpperCase();
  if (isDemoMode()) {
    const users = await listDemoUsers();
    if (!users.some(user => user.matricule === normalized)) throw new Error("USER_NOT_FOUND");
    await saveDemoUsers(users.filter(user => user.matricule !== normalized));
    return;
  }
  requireDatabaseUrl();
  const result = await prisma.authAccount.deleteMany({ where: { matricule: normalized } });
  if (result.count === 0) throw new Error("USER_NOT_FOUND");
}
