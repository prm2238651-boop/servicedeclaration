import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function prompt(label: string, secret = false): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("Run this command from an interactive terminal");
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(wasRaw ?? false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Account creation cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!secret) process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " " && character <= "~") {
          value += character;
          if (!secret) process.stdout.write(character);
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  const { createStoredUser, listStoredUsers } = await import("../lib/user-store");
  if (process.env.DEMO_MODE === "true") {
    throw new Error("Set DEMO_MODE to false or unset it before creating a production administrator");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");

  const users = await listStoredUsers();
  if (users.some(user => user.role === "SUPER_ADMIN")) {
    throw new Error("A SUPER_ADMIN account already exists");
  }

  const matricule = (await prompt("Matricule: ")).trim().toUpperCase();
  const name = (await prompt("Nom complet: ")).trim();
  const service = (await prompt("Service: ")).trim();
  const password = await prompt("Mot de passe (12 caractères minimum): ", true);
  const confirmation = await prompt("Confirmer le mot de passe: ", true);

  if (matricule.length < 3 || name.length < 3 || service.length < 3) {
    throw new Error("Matricule, nom et service doivent contenir au moins 3 caractères");
  }
  if (password.length < 12) throw new Error("The administrator password must contain at least 12 characters");
  if (password !== confirmation) throw new Error("The passwords do not match");

  const account = await createStoredUser({
    matricule,
    name,
    role: "SUPER_ADMIN",
    service,
    permissions: [],
    password,
  });
  console.log(`Created initial administrator ${account.matricule}. TOTP enrollment is required at first login.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Failed to create administrator");
  process.exitCode = 1;
});
