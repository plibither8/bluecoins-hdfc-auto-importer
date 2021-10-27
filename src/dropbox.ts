import { config as envConfig } from "dotenv";
import { Dropbox, DropboxResponse } from "dropbox";
import fs from "fs/promises";
import path from "path";
import constants from "./constants";
import { FileMetadataWithFileBinary } from "./dropbox.interface";

envConfig({ path: path.resolve(__dirname, "../.env") });

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
