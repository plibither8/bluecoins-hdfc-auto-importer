import { files } from "dropbox";

export interface FileMetadataWithFileBinary extends files.FileMetadata {
  fileBinary: Buffer;
}
