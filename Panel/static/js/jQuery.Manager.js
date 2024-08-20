require("bytenode");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { title, version } = require("../../package.json");
const { ipcRenderer, contextBridge } = require("electron");
const { FindEmulator, InjectFile, InjectValues, AsyncFindValues, AsyncLegitFindValues, globalShortcut } = require("../../jQ/index.jsc");

let logged, isStreamer = false, isInternetBlocked = false, alert_audio = () => { isStreamer ? null : (new Audio("alert.wav")).play(); };
window.addEventListener('contextmenu', e => e.preventDefault()); window.addEventListener("DOMContentLoaded", () => {
    const jQuery = require("./jQuery.js"), $ = selector =>
        jQuery(typeof selector !== "string" ? selector : document.querySelectorAll(selector));


    $("header span.title").html(`${title}<version>[${version}]</version>`);
    const addZero = n => n < 10 ? `0${n}` : `${n}`,
        GetDate = time => {
            const current_time = new Date(time || new Date());

            return `${addZero(current_time.getDate())}-${addZero(current_time.getMonth() + 1)}-${current_time.getFullYear()}`;
        },
        GetCurrentTime = time => {
            const current_time = new Date(time || new Date());
            const current_hours = current_time.getHours();

            return `${addZero(current_hours > 12 ? current_hours - 12 : current_hours)}:${addZero(current_time.getMinutes())}:${addZero(current_time.getSeconds())} ${current_hours >= 12 ? 'PM' : 'AM'}`;
        };


    const t = $("div#terminal");
    const terminal = t.toArray().at(0); console = {
        ...console, ...{
            __log: msg => {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><data>${msg}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
            },
            __error: err => {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><error>${err}</error></span>`); terminal.scrollBy(0, terminal.scrollHeight);
            }
        }
    };


    let IWantButton;
    $("bind").click(async ({ currentTarget }) => {
        const n = await (() => new Promise(resolve => {
            if (IWantButton) {
                IWantButton(false);
                IWantButton = resolve;
            } else
                IWantButton = resolve;
        }))();
        if (!n)
            return;

        if (n.name === "Home" || n.name === "Insert")
            console.__log(`Please select another key, ${n.name} is system registered`);

        else {
            const parent = $(currentTarget).addClass("added")
                .html(n.name.toLocaleUpperCase()).parent().parent().data("n", n.code).data("name", n.name);

            if (parent.data("code") && parent.data("callback-up") && parent.data("callback-down")) {
                globalShortcut.removeListener(`up-${parent.data("code")}`, parent.data("callback-up"));
                globalShortcut.removeListener(`down-${parent.data("code")}`, parent.data("callback-down"));
            };
        };
    });

    window.addEventListener("keydown", async e => {
        if (logged)
            e.preventDefault();
    });

    globalShortcut.addListener("down", async e => {
        if (IWantButton) {
            IWantButton(e);
            IWantButton = null;
        };
    });


    contextBridge.exposeInMainWorld("SetPage", name => {
        $('nav div#main').attr('page', name);

        $('menu.main button').removeClass('selected');
        $(`menu.main button[name="${name}"]`).addClass('selected');
    });


    contextBridge.exposeInMainWorld("InitLogin", async () => {
        const user = $('input#user').val();
        const pass = $('input#pass').val();

        const btn = $('main[name="LOGIN"] menu div button');
        const status = $('main[name="LOGIN"] menu div span.status');

        const svg = btn.find('svg'), span = btn.find('span'); if (svg.hasClass('hidden')) {
            if (user.length > 0 && pass.length > 0) {
                status
                    .html(''); span.addClass('hidden'); svg.removeClass('hidden');

                try {
                    const data = await ipcRenderer.invoke("WantAxios", `/client/login?user=${user}&pass=${pass}`); if (data.status) {
                        $('span.expiry').html(`<time>${data.data.expiry === "LIFETIME" ? "LIFETIME" : `${GetCurrentTime(data.data.expiry)} ${GetDate(data.data.expiry)}`}</time>`);

                        data.data.license.map(license => {
                            const page = $(`#${license.page}`)
                                .attr("license", "true"); $(`menu.main button[name="${license.page}"]`).attr("license", "true").parent().attr("license", "true");

                            if (license.name === "ALL")
                                page.find(`div[license="false"]`).attr("license", "true").parent().attr("license", "true");
                            else
                                page.find(`div[name="${license.name}"]`).attr("license", "true").parent().attr("license", "true");
                        });

                        logged = true;
                        const FirstFeature = $('menu.main button[license="true"]').toArray();

                        if (FirstFeature.length > 0) {
                            $(FirstFeature.at(0)).addClass('selected');
                            $("nav div#main").parent().attr("license", "true");
                            $("nav div#main").attr('page', FirstFeature.at(0).getAttribute("name"));

                            setTimeout(async () => {
                                await alert_audio();
                                await ipcRenderer.invoke("SetSize", 800, 500, user);

                                $('body').attr('page', 'PANEL');
                                $('head').data('token', data.data.authToken);
                            }, 800);
                        } else {
                            $("main[name='PANEL'] nav:first-child").addClass("BYPASS", "true");
                            setTimeout(async () => {
                                await alert_audio();
                                $('body').attr('page', 'PANEL');
                                $('head').data('token', data.data.authToken);
                            }, 800);
                        };
                    } else {
                        span
                            .removeClass('hidden'); svg.addClass('hidden'); status.html(data?.err || "Server under maintenance. Please try again later or contact support.");
                    };
                } catch (err) {
                    console.log(err); span.removeClass('hidden'); svg
                        .addClass('hidden'); status.html('Server under maintenance. Please try again later or contact support.');
                }
            } else {
                span.removeClass('hidden'); svg
                    .addClass('hidden'); status.html('Enter your Username and Password');
            };
        };
    });


    contextBridge.exposeInMainWorld("InjectMenu", async (name, visual) => {
        const menu = $(`menu.location div[name="${name}"]`);
        if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
            let process = FindEmulator();
            if (process.length > 0) {
                menu.addClass('injecting');
                console.__log(`Injecting ${visual}`);

                try {
                    const current_time = (new Date()).getTime(),
                        url = path.join(os.tmpdir(), `${Buffer.from(`${name}@${title}-${version}`).toString("base64url")}.dll`); const data = await (() => new Promise(async resolve => {
                            if (fs.existsSync(url))
                                try {
                                    resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `${visual} DLL injection failed. Please restart the emulator or check it.` });
                                } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual} DLL file. Try again later.` }); }
                            else
                                if (fs.existsSync(path.join(__dirname, "..", "..", "jQMenu", `${name}.dll`)))
                                    try {
                                        fs.copyFileSync(path.join(__dirname, "..", "..", "jQMenu", `${name}.dll`), url);
                                        resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `${visual} DLL injection failed. Please restart the emulator or check it.` });
                                    } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual} DLL file. Try again later.` }); }
                                else
                                    resolve({ status: false, err: `Cheat Menu not ready yet. Please check back later.` });
                        }))();

                    menu.removeClass('injecting'); if (data.status) {
                        await alert_audio();
                        console.__log(`Injected ${visual} in (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s)`);
                    } else
                        console.__error(data.err);
                } catch (err) {
                    console.log(err);

                    menu.removeClass('injecting');
                    console.__error(`Failed to inject ${visual} DLL file. Try again later.`);
                };
            } else
                console.__error("Emulator not detected. Please ensure it is running and try again.");
        } else if (menu.hasClass('injected'))
            menu.removeClass('injected');
    });


    const skipWarnCode = new Set(), cheat_codes = {};
    contextBridge.exposeInMainWorld("InjectCheat", async (name, visual) => {
        let process = FindEmulator(); if (process.length > 0) {
            const menu = $(`div[name="${name}"]`); if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
                if (menu.find("button").toArray().length == 1)
                    try {
                        menu.addClass("injecting");
                        const current_time = (new Date()).getTime(); const data = await (() => new Promise(async resolve => {
                            try {
                                if (!(name in cheat_codes)) {
                                    console.__log(`Fetching latest codes for ${visual}`);
                                    const res = await ipcRenderer.invoke("WantAxios", `/cheat/code/${name}`, $('head').data('token')); if (res.status) {
                                        const data = JSON.parse(Buffer.from(Buffer
                                            .from(res.data, "hex").toString("utf8").split("").reverse().join(""), "base64url").toString("utf8")); if (data.status || skipWarnCode.has(name)) {
                                                skipWarnCode.delete(name);
                                                console.__log(`Injecting ${visual}`);

                                                try {
                                                    cheat_codes[name] = data.data;
                                                    let cheatCodes = await Promise.all(data.data.map(([scanValue, replaceValue, repValue]) => new Promise(async resolve => {
                                                        replaceValue = repValue ? replaceValue : Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))); try {
                                                            scanValue = scanValue
                                                                .split(" ").map(i => i == "??" ? "?" : i).join(" ");

                                                            resolve({ address: await AsyncFindValues(process.at(0).pid, scanValue), replaceValue, repValue });
                                                        } catch (err) { console.log(err); resolve({ address: [], replaceValue, repValue }); };
                                                    })));

                                                    if (cheatCodes.filter(({ address }) => address.length == 0).length > 0)
                                                        return resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });

                                                    await Promise.all(cheatCodes.map(async ({ address, replaceValue, repValue }) => await InjectValues(process.at(0).pid, address, replaceValue, repValue)));

                                                    let i = 0; cheatCodes
                                                        .forEach(({ address }) => address.forEach(() => i++)); resolve({ status: true, replaces: i });
                                                } catch (err) {
                                                    console.log(err); resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });
                                                };
                                            } else {
                                            skipWarnCode
                                                .add(name); resolve({ status: false, err: `Warning: ${visual} is not safe. If you still want to proceed, click again.` });
                                        };
                                    } else
                                        resolve(res);
                                } else {
                                    console.__log(`Injecting ${visual}`); try {
                                        let cheatCodes = await Promise.all(cheat_codes[name].map(([scanValue, replaceValue, repValue]) => new Promise(async resolve => {
                                            replaceValue = repValue ? replaceValue : Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))); try {
                                                scanValue = scanValue
                                                    .split(" ").map(i => i == "??" ? "?" : i).join(" ");

                                                resolve({ address: await AsyncFindValues(process.at(0).pid, scanValue), replaceValue, repValue });
                                            } catch (err) { console.log(err); resolve({ address: [], replaceValue, repValue }); };
                                        })));

                                        if (cheatCodes.filter(({ address }) => address.length == 0).length > 0)
                                            return resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });

                                        await Promise.all(cheatCodes.map(async ({ address, replaceValue, repValue }) => await InjectValues(process.at(0).pid, address, replaceValue, repValue)));

                                        let i = 0; cheatCodes
                                            .forEach(({ address }) => address.forEach(() => i++)); resolve({ status: true, replaces: i });
                                    } catch (err) {
                                        console.log(err); resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });
                                    };
                                };
                            } catch (err) { console.log(err); resolve({ status: false, err: `Failed to download the latest codes from the server. Please check your connection or try again later.` }); };
                        }))();

                        menu.removeClass('injecting'); if (data.status) {
                            await alert_audio();
                            console.__log(`Injected ${visual} in (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s).`);
                        } else
                            console.__error(data.err);
                    } catch (err) {
                        console.log(err);
                        console.__error(`Failed to download the latest codes from the server. Please check your connection or try again later.`);

                        menu.removeClass('injecting');
                    }

                else if (menu.find("bind").toArray().length == 1)
                    if (menu.data("n"))
                        try {
                            menu.addClass("injecting");
                            const current_time = (new Date()).getTime(); const data = await (() => new Promise(async resolve => {
                                try {
                                    if (!(name in cheat_codes)) {
                                        console.__log(`Fetching latest codes for ${visual}`);
                                        const res = await ipcRenderer.invoke("WantAxios", `/cheat/code/${name.replace("[LEGIT]", "")}`, $('head').data('token')); if (res.status) {
                                            const data = JSON.parse(Buffer.from(Buffer
                                                .from(res.data, "hex").toString("utf8").split("").reverse().join(""), "base64url").toString("utf8")); if (data.status || skipWarnCode.has(name)) {
                                                    skipWarnCode.delete(name);
                                                    console.__log(`Injecting ${visual}`);

                                                    try {
                                                        cheat_codes[name] = data.data;
                                                        let cheatCodes = await Promise.all(data.data.map(([scanValue, replaceValue]) => new Promise(async resolve => {
                                                            replaceValue = Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))); try {
                                                                scanValue = scanValue
                                                                    .split(" ").map(i => i == "??" ? "?" : i).join(" ");

                                                                resolve({ address: await AsyncLegitFindValues(process.at(0).pid, scanValue), replaceValue });
                                                            } catch (err) { console.log(err); resolve({ address: [], replaceValue }); };
                                                        })));

                                                        if (cheatCodes.filter(({ address }) => address.length == 0).length > 0)
                                                            return resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });

                                                        resolve({ status: true, address: cheatCodes });
                                                    } catch (err) {
                                                        console.log(err); resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });
                                                    };
                                                } else {
                                                skipWarnCode
                                                    .add(name); resolve({ status: false, err: `Warning: ${visual} is not safe. If you still want to proceed, click again.` });
                                            };
                                        } else
                                            resolve(res);
                                    } else {
                                        console.__log(`Injecting ${visual}`); try {
                                            let cheatCodes = await Promise.all(cheat_codes[name].map(([scanValue, replaceValue]) => new Promise(async resolve => {
                                                replaceValue = Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))); try {
                                                    scanValue = scanValue
                                                        .split(" ").map(i => i == "??" ? "?" : i).join(" ");

                                                    resolve({ address: await AsyncLegitFindValues(process.at(0).pid, scanValue), replaceValue });
                                                } catch (err) { console.log(err); resolve({ address: [], replaceValue }); };
                                            })));

                                            if (cheatCodes.filter(({ address }) => address.length == 0).length > 0)
                                                return resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });

                                            resolve({ status: true, address: cheatCodes });
                                        } catch (err) {
                                            console.log(err); resolve({ status: false, err: `Failed to get the required address by ${visual}. Please check the emulator and try again.` });
                                        };
                                    };
                                } catch (err) { console.log(err); resolve({ status: false, err: `Failed to download the latest codes from the server. Please check your connection or try again later.` }); };
                            }))();

                            menu.removeClass('injecting'); if (data.status) {
                                try {
                                    const code = menu.data("n");

                                    let resAddresses = data.address
                                        .map(({ address, replaceValue }) => ({ address: address.map(({ address }) => address), replaceValues: address.map(() => replaceValue), currentValues: address.map(({ currentValue }) => currentValue) }));

                                    const injectionAddresses = resAddresses.map(({ address, replaceValues }) => ([address, replaceValues])),
                                        deinjectionAddresses = resAddresses.map(({ address, currentValues }) => ([address, currentValues]));
                                    menu
                                        .data("code", code)
                                        .data("callback-up", async () => { try { deinjectionAddresses.map(deinjectionAddresses => InjectValues(process.at(0).pid, ...deinjectionAddresses)) } catch { }; })
                                        .data("callback-down", async () => { try { injectionAddresses.map(injectionAddresses => InjectValues(process.at(0).pid, ...injectionAddresses)) } catch { }; });

                                    globalShortcut.addListener(`up-${code}`, menu.data("callback-up"));
                                    globalShortcut.addListener(`down-${code}`, menu.data("callback-down")); await alert_audio();
                                    console.__log(`Injected ${visual} in (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s).`);
                                } catch (err) {
                                    console.log(err);
                                    console.__error(`Please select another key, ${menu.data("name")} is system registered`);
                                };
                            } else
                                console.__error(data.err);
                        } catch (err) {
                            console.log(err);
                            console.__error(`Failed to download the latest codes from the server. Please check your connection or try again later.`);

                            menu.removeClass('injecting');
                        }
                    else
                        console.__error(`No key selected. Please select a key to proceed.`);
            } else if (menu.hasClass('injected'))
                menu.removeClass('injected');
        } else
            console.__error("Emulator not detected. Please ensure it is running and try again.");
    });


    contextBridge.exposeInMainWorld("Minimize", () => ipcRenderer.invoke("Hide"));
    contextBridge.exposeInMainWorld("HandleClose", () => ipcRenderer.invoke("End"));

    contextBridge.exposeInMainWorld("ToggleMode", () => {
        ipcRenderer
            .invoke("SetMode", !isStreamer);
        isStreamer ? $("header button.stream").removeClass("active").addClass("inactive") : $("header button.stream").removeClass("inactive").addClass("active"); isStreamer = !isStreamer;
    });

    contextBridge.exposeInMainWorld("ToggleInternet", async () => {
        if (isInternetBlocked) {
            await Promise.all([
                `netsh advfirewall firewall delete rule name="FF Block In1"`,
                `netsh advfirewall firewall delete rule name="FF Block In2"`,
                `netsh advfirewall firewall delete rule name="FF Block In3"`,
                `netsh advfirewall firewall delete rule name="FF Block In4"`,
            ]
                .map(async e => {
                    try {
                        let proc = exec(e);
                        proc.stderr.addListener("data", console.log);
                        proc.stdout.addListener("data", console.log);
                    } catch { };
                }));

            $("header button.internet").removeClass("inactive").addClass("active"); isInternetBlocked = false;
        } else {
            await Promise.all([
                `netsh advfirewall firewall add rule name="FF Block In1" dir=in action=block program="%ProgramFiles%\\BlueStacks_nxt\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In1" dir=out action=block program="%ProgramFiles%\\BlueStacks_nxt\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In2" dir=in action=block program="%ProgramFiles%\\BlueStacks\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In2" dir=out action=block program="%ProgramFiles%\\BlueStacks\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In3" dir=in action=block program="%ProgramFiles%\\BlueStacks_msi2\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In3" dir=out action=block program="%ProgramFiles%\\BlueStacks_msi2\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In4" dir=in action=block program="%ProgramData%\\BlueStacks_msi5\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In4" dir=out action=block program="%ProgramData%\\BlueStacks_msi5\\HD-Player.exe"`,
            ]
                .map(async e => {
                    try {
                        let proc = exec(e);
                        proc.stderr.addListener("data", console.log);
                        proc.stdout.addListener("data", console.log);
                    } catch { };
                }));

            $("header button.internet").removeClass("active").addClass("inactive"); isInternetBlocked = true;
        };
    })
});