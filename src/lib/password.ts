import * as argon2 from "argon2";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  // same argon2 params as real hashes, computed once
  return (dummyHash ??= hashPassword("not-a-real-password-for-timing"));
}