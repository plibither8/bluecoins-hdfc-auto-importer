import { config as envConfig } from "dotenv";
import path from "path";
import fs from "fs/promises";
import { Dropbox, DropboxResponse, files } from "dropbox";
import constants from "./constants";

envConfig({ path: path.resolve(__dirname, "../.env") });

interface FileMetadataWithFileBinary extends files.FileMetadata {
  fileBinary: Buffer;
}

const dropboxClient = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
});

export async function downloadFiles() {
  await fs.mkdir(path.resolve(__dirname, "../temp"), { recursive: true });

  // Download the database and tracker file
  await Promise.all(
    [constants.database, constants.tracker].map(async (file) => {
      const {
        result: { fileBinary },
      } = (await dropboxClient.filesDownload({
        path: file.remote,
      })) as DropboxResponse<FileMetadataWithFileBinary>;
      await fs.writeFile(file.local, fileBinary);
    })
  );
}

export async function uploadFiles() {
  await Promise.all(
    [constants.database, constants.tracker].map(async (file) => {
      const fileBinary = await fs.readFile(file.local);
      await dropboxClient.filesUpload({
        contents: fileBinary,
        path: file.remote,
        mode: { ".tag": "overwrite" },
      });
    })
  );
}
