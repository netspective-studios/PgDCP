import { colors } from "../deps.ts";

export interface GitStatusBehavior {
  label: string;
  colored: (text: string) => string;
}

export const gitStatusMap: Record<string, GitStatusBehavior> = {
  "--": {
    colored: (text) => {
      return colors.dim(text);
    },
    label: "unmodified",
  },
  "M": {
    colored: (text) => {
      return colors.yellow(text);
    },
    label: "modified",
  },
  "A": {
    colored: (text) => {
      return colors.green(text);
    },
    label: "added",
  },
  "D": {
    colored: (text) => {
      return colors.red(text);
    },
    label: "deleted",
  },
  "R": {
    colored: (text) => {
      return colors.blue(text);
    },
    label: "renamed",
  },
  "C": {
    colored: (text) => {
      return colors.cyan(text);
    },
    label: "copied",
  },
  "??": {
    colored: (text) => {
      return colors.brightGreen(text);
    },
    label: "untracked",
  },
};

export interface GitAssetStatus {
  readonly fileName: string;
  readonly statusCode: string;
  readonly status: GitStatusBehavior;
}

export async function gitStatus(
  fileName: string,
): Promise<GitAssetStatus | undefined> {
  const cmd = Deno.run({
    cmd: ["git", "status", "--porcelain", fileName],
    stdout: "piped",
    stderr: "piped",
  });

  const outputBuf = await cmd.output();
  const errorBuf = await cmd.stderrOutput();
  cmd.close();

  const statusRegex = /^([AMRDC]|\?\?)\s+([\w\d\/\.\-_]+)/;
  const output = new TextDecoder().decode(outputBuf).trim();
  const stderr = new TextDecoder().decode(errorBuf);
  if (stderr.length > 0) {
    console.log(output, stderr);
  }
  if (output == "") {
    const statusCode = "--";
    return {
      fileName,
      statusCode: statusCode,
      status: gitStatusMap[statusCode],
    };
  } else {
    const line = output.split("\n").pop();
    const statusParts = statusRegex.exec(line || "");
    if (statusParts) {
      const statusCode = statusParts[1];
      return {
        fileName: statusParts[2],
        statusCode: statusCode,
        status: gitStatusMap[statusCode],
      };
    }
  }
}
