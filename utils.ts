import { join } from "node:path";
import { SocketAddress } from "bun";

export class ElysiaRequest extends Request {
    public ipAddress: SocketAddress | null;
};

export class Env {
    static get Port(): number {
        return Number(process.env.PORT);
    };

    static get Runtime(): string {
        return process.env.NODE_ENV == "RUN" ? "CLOUD" : "LOCAL";
    };

    static get CurrentOB(): number {
        return Number((process.env.OB_VERSION as string).replace("OB", ""));
    };

    static get MongoDBUrl(): string {
        return process.env.MONGODB_URL as string;
    };

    static get DiscordUrl(): string {
        return process.env.DISCORD_URL as string;
    };
};

const currentVersion: Array<Number> = (await import(
    join(__dirname, "package.json"))).version.split(".").map((i: string) => Number(i.replace("v", "")));

export class Version {
    #version: Array<Number>;
    constructor(checkVersion: string) {
        this.#version = checkVersion
            .split(".").map((i: string) => Number(i.replace("v", "")));
    };

    public get isUpdated(): boolean {
        return Bun.semver.order(currentVersion.join("."), this.#version.join(".")) == 0;
    };


    public get isMajorUpdate(): boolean {
        return Bun.semver.order(currentVersion.slice(0, 2).join("."), this.#version.slice(0, 2).join(".")) == 1;
    };

    public get isMinorUpdate(): boolean {
        return Bun.semver.order(currentVersion.slice(0, 3).join("."), this.#version.slice(0, 3).join(".")) == 1;
    };
};


export class UserAgent {
    constructor(cpuModel: string, cpuThreads: string, ramSize: string, osVersion: string) {
        this.#encoded = Buffer.from(Buffer.from(Buffer
            .from(`[${cpuModel}, ${cpuThreads}, ${ramSize}GB, ${osVersion}, ${Env.Runtime}, ${Env.Port}]`)
            .toString("base64").split("").reverse().join(""), "utf8").toString("hex").split(" ").reverse().join(""), "utf8").toString("base64url");

        this.#readable = `${cpuModel} with ${cpuThreads} Threads and ${ramSize} GB RAM. Installed on ${osVersion}.`;
    };

    #encoded: string;
    public get Encoded(): string {
        return Bun.hash(this.#encoded).toString();
    };

    #readable: string;
    public get Readable(): string {
        return this.#readable;
    };
};