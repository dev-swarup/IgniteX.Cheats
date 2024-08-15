const proc = require("child_process")
    .spawn("bun", ["index.ts"], { shell: false }); proc.stdout.pipe(process.stdout); proc.stderr.pipe(process.stderr);