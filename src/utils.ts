import { createHash } from "crypto";
import path from "path";
import { PptrElement } from "./hdfc.interface";
import { spawnSync } from "child_process";

export const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const amountToDecimal = (str: string) =>
  Number(str.trim().replace(/,/g, ""));

export const hash = ({
  description,
  id,
}: {
  description: string;
  id: string;
}) => createHash("md5").update(`${description}${id}`).digest("hex");

export const formatCurrency = (num: string | number) =>
  `₹ \`${Number(num).toLocaleString("en-IN")}\``;

export const getJson = async <T = any>(
  filename: string,
  fallback?: T
): Promise<T | undefined> => {
  try {
    return (await import(path.resolve(__dirname, "../", filename)))
      .default as T;
  } catch (err) {
    console.log(err);
    return fallback || undefined;
  }
};

export const innerText = (element: PptrElement) =>
  element.evaluate((el: HTMLElement) => el.innerText.trim());

export const bluecoinsDateFormat = (date: Date): string =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .replace("T", " ")
    .split(".")[0];

export const killSelf = () => {
  spawnSync("pkill", ["-f", "bluecoins-hdfc-auto-importer"]);
  process.exit(0);
};
