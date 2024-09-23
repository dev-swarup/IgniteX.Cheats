import { join } from "node:path";
import { SocketAddress } from "bun";


export class ElysiaRequest extends Request {
    public ipAddress: SocketAddress | null;
};


export class Env {
    static get port(): number {
        return Number(process.env.PORT);
    };

    static get runtime(): string {
        return process.env.NODE_ENV == "RUN" ? "CLOUD" : "LOCAL";
    };

    static get mongodb_url(): string {
        return process.env.MONGODB_URL as string;
    };


    static get currentOB(): string {
        return process.env.OB_VERSION as string;
    };

    static get discord_url(): string {
        return process.env.DISCORD_URL as string;
    };
};


const currentVersion: Array<Number> = (await import(
    join(__dirname, "package.json"))).version.split(".").map((i: string) => Number(i.replace("v", "")));

export class Version {
    #version: Array<Number>;
    constructor(checkVersion: string) {
        this.#version = checkVersion.split(".").map((i: string) => Number(i.replace("v", "")));
    };


    public get isUpdated(): boolean {
        return currentVersion.map((i, index) => i == this.#version[index]).findIndex(i => !i) < 0;
    };

    public get isMajorUpdate(): boolean {
        return currentVersion[0] == this.#version[0] && currentVersion[1] > this.#version[1];
    };

    public get isMinorUpdate(): boolean {
        return currentVersion[0] == this.#version[0] && currentVersion[1] == this.#version[1] && currentVersion[2] > this.#version[2];
    };
};


export class UserAgent {
    constructor(cpuModel: string, cpuThreads: string, ramSize: string, osVersion: string) {
        this.#encoded = Buffer.from(Buffer.from(Buffer
            .from(`[${cpuModel}, ${cpuThreads}, ${ramSize}GB, ${osVersion}, ${Env.runtime}, ${Env.port}]`).toString("base64")
            .split("").reverse().join(""), "utf8").toString("hex").split(" ").reverse().join(""), "utf8").toString("base64url");

        this.#readable = `${cpuModel} with ${cpuThreads} Threads and ${ramSize} GB RAM. Installed on ${osVersion}.`;
    };

    #encoded: string;
    public get encoded(): string {
        return this.#encoded;
    };

    #readable: string;
    public get readable(): string {
        return this.#readable;
    };
};