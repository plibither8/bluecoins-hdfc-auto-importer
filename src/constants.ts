import path from "path";

export default {
  database: {
    remote: "/apps/bluecoins/quicksync/bluecoins.fydb",
    local: path.resolve(__dirname, "../temp/bluecoins.fydb"),
  },
  tracker: {
    remote: "/apps/bluecoins/quicksync/tracker_file",
    local: path.resolve(__dirname, "../temp/tracker_file"),
  },
  accountsMap: {
    Primary: 2,
    Secondary: 1617713912612,
  },
};
