const $ = selector => require("./jQuery.js")
    (selector ? typeof selector !== "string" ? selector : document.querySelectorAll(selector) : document.documentElement);
const addZero = n => n < 10 ? `0${n}` : `${n}`,
    GetDate = time => {
        const current_time = new Date(time || new Date());

        return `${addZero(current_time.getDate())}-${addZero(current_time.getMonth() + 1)}-${current_time.getFullYear()}`;
    },
    GetCurrentTime = time => {
        const current_time = new Date(time || new Date());
        const current_hours = current_time.getHours();

        return `${addZero(current_hours > 12 ? current_hours - 12 : current_hours)}:${addZero(current_time.getMinutes())} ${current_hours >= 12 ? 'PM' : 'AM'}`;
    };

let IWantButton, logged, cheat_codes = {},
    isHidden, isInternetBlocked = false, alertAudio = new Audio(`data:audio/wav;base64,/*{alert.wav}*/`);
contextBridge.exposeInMainWorld("InitLogin", async () => {
    const user = $('input#user').val();
    const pass = $('input#pass').val();

    const btn = $('main[name="LOGIN"] menu div button');
    const status = $('main[name="LOGIN"] menu div span.status');

    const svg = btn.find('svg'), span = btn.find('span'); if (svg.hasClass('hidden')) {
        status
            .html(''); span.addClass('hidden'); svg.removeClass('hidden'); setTimeout(async () => {
                if (user.length > 0 && pass.length > 0) {
                    try {
                        const data = await ipcRenderer.invoke("HandleAxios", `/client/login?user=${user}&pass=${pass}`); if (data.status) {
                            data.data.codes.map(cheat => ({
                                ...cheat, data: cheat.data.map(i => JSON.parse(Buffer.from(Buffer
                                    .from(i, "hex").toString("utf8").split("").reverse().join(""), "base64").toString("utf8")))
                            })).forEach(cheat => cheat_codes[cheat.name] = cheat);

                            console.log(data.data);
                            $(".location").addClass(data.data.locations); async function prepareVisual() {
                                data.data.codes.forEach(({ name, page, status }) => {
                                    const page_ = $(`${page == "GLOBAL" ? "main[name='PANEL']" : `#${page}`}`); page_.find(`*[name][license="false"]`).toArray().forEach(ele => {
                                        ele = $(ele); if (name == ele.attr("name")) {
                                            page_.attr("license", "true"); ele
                                                .attr("license", "true").parent().attr("license", "true");

                                            $(`menu.main button[name="${page}"]`).attr("license", "true").parent().attr("license", "true");
                                        };
                                    });

                                    $(`*[name="${name}"]`).attr("status", status);
                                });
                            };

                            logged = true; await prepareVisual();
                            const FirstFeature = $('menu.main button[license="true"]').toArray();

                            if (FirstFeature.length > 0) {
                                $(`button[name="USER"]`).addClass('selected');

                                $("nav div#main").attr('page', "USER");
                                $("nav div#main").parent().attr("license", "true");

                                const page = $("page#USER");
                                page.find(".option.user .value").text(user); if (data.data.expiry == "LIFETIME")
                                    page.find(".option.expiry .value").text("LIFETIME");
                                else
                                    page.find(".option.expiry .value").text(`${GetCurrentTime(data.data.expiry)} ${GetDate(data.data.expiry)}`);

                                await ipcRenderer.send("WindowSize", 800, 500, user); setTimeout(async () => {
                                    $('body').attr('page', 'PANEL').removeClass("move");

                                    if (!isHidden)
                                        await alertAudio.play();
                                }, 100);
                            } else {
                                span.removeClass('hidden'); svg
                                    .addClass('hidden'); status.html('Currently, Panel is not safe. Wait for next update.');
                            };
                        } else {
                            span
                                .removeClass('hidden'); svg.addClass('hidden'); status.html(data?.err || "Error while making the request. Make sure you have good internet connection.");
                        };
                    } catch (err) {
                        console.log(err);
                        span.removeClass('hidden'); svg
                            .addClass('hidden'); status.html('Error while making the request. Make sure you have good internet connection.');
                    };
                } else {
                    span.removeClass('hidden'); svg
                        .addClass('hidden'); status.html('Enter your Username and Password');
                };
            }, 100);
    };
});


window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener("DOMContentLoaded", () => {
    document.documentElement.innerHTML = Buffer.from(Buffer.from(`/*{index.html}*/`, "base64").toString("utf8"));
    const t = $("div#terminal"), logger = console.log; const terminal = t.toArray().at(0); console = {
        ...console, ...{
            log: (...msg) => isBuilt ? null : logger(...msg), __log: msg => {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><data>${msg}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
            },
            __error: err => {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><error>${err}</error></span>`); terminal.scrollBy(0, terminal.scrollHeight);
            }
        }
    };

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

        if (n.name == "Home" || n.name == "Insert")
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
        if (logged && process.env.isBuilt == "true")
            e.preventDefault();
    });

    globalShortcut.addListener("down", async e => {
        if (IWantButton) {
            IWantButton(e);
            IWantButton = null;
        };
    });

    const bd = $("body");
    ipcRenderer.on("move", async () => bd.addClass("move"));
    ipcRenderer.on("moved", async () => bd.removeClass("move"));
    ipcRenderer.on("isHidden", async (i, value) => {
        isHidden = value;

        value ? (() => {
            $("body").addClass("streamer");
            $(".option.streamer").addClass("injected");
        })() : null;
    });

    contextBridge.exposeInMainWorld("SetPage", async name => {
        if (!logged)
            return await ipcRenderer.invoke("reportThisUser", "Bypassed the Login Page");


        $('nav div#main').attr('page', name);

        $('menu button').removeClass('selected');
        $('button[name="USER"]').removeClass('selected');
        (name == "USER" ? $('button[name="USER"]') : $(`menu button[name="${name}"]`)).addClass('selected');
    });

    contextBridge.exposeInMainWorld("InjectMenu", async (name, visual) => {
        if (!logged)
            return await ipcRenderer.invoke("reportThisUser", "Bypassed the Login Page");


        const menu = $(`menu.location div[name="${name}"]`), process = FindEmulator();
        if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
            if (process.length > 0) {
                menu.addClass('injecting');
                console.__log(`Injecting${" " + visual}`);

                try {
                    const current_time = (new Date()).getTime(),
                        url = path.join(os.tmpdir(), `${Buffer.from(`${name}@${title}-${version}`).toString("base64url")}.dll`); const data = await (() => new Promise(async resolve => {
                            if (fs.existsSync(url))
                                try {
                                    try { fs.writeFileSync(url, Buffer.from(Buffer.from(jQMenu[name], "base64url").toString("utf8").split("").reverse().join(""), "hex")); } catch { };
                                    resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `${visual} injection failed.` });
                                } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. Try again.` }); }
                            else
                                if (name in jQMenu)
                                    try {
                                        fs.writeFileSync(url, Buffer.from(Buffer.from(jQMenu[name], "base64url").toString("utf8").split("").reverse().join(""), "hex"));
                                        resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `${visual} injection failed.` });
                                    } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. Try again.` }); }
                                else
                                    resolve({ status: false, err: `${visual} is not ready yet.` });
                        }))();

                    menu.removeClass('injecting'); if (data.status) {
                        if (!isHidden)
                            await alertAudio.play();
                        console.__log(`Injected ${visual} (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s)`);
                    } else
                        console.__error(data.err);
                } catch (err) {
                    console.log(err);
                    menu.removeClass('injecting');
                    console.__error(`Failed to inject ${visual} DLL file. Try again.`);
                };
            } else {
                menu.removeClass('injecting');
                console.__error("Emulator not detected. Please ensure it is running.");
            }
        } else if (menu.hasClass('injected'))
            menu.removeClass('injected');
    });

    contextBridge.exposeInMainWorld("InjectCheat", async (name, visual) => {
        if (!logged)
            return await ipcRenderer.invoke("reportThisUser", "Bypassed the Login Page");

        const menu = $(`div[name="${name}"]`);
        if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
            let process = FindEmulator(); if (process.length > 0) {
                try {
                    if (menu.find("bind").toArray().length == 1 && !menu.data("n"))
                        return console.__error(`This function required a key. Select a key to proceed.`);

                    menu.addClass("injecting");
                    const current_time = (new Date()).getTime(); const data = await (() => new Promise(async resolve => {
                        if (name in cheat_codes) {
                            const res = cheat_codes[name];
                            console.__log(`Injecting${" " + visual}`);

                            try {
                                let cheatCodes = await Promise.all(res.data.map(([maxCount, scanValue, replaceValue]) => new Promise(async resolve => {
                                    try {
                                        const address = await AsyncFindValues(process.at(0).pid, scanValue); if (Array.isArray(replaceValue))
                                            if (maxCount == "*" || address.length <= maxCount)
                                                resolve({ status: true, address, replaceValue });
                                            else
                                                resolve({ status: false, err: `${visual} is patched, Don't use it.` });
                                        else
                                            resolve({ status: true, address, replaceValue: Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))) });
                                    } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. Please check the emulator.` }); };
                                })));

                                let status = cheatCodes.filter(e => !e.status); if (status.length > 0)
                                    return resolve({ status: false, err: status[0].err });

                                status = cheatCodes.filter(({ address }) => address.length == 0); if (status.length > 0)
                                    return resolve({ status: false, err: `Failed to inject ${visual}. [SCAN ERROR]` });

                                if (menu.find("button").toArray().length >= 1) {
                                    await Promise.all(cheatCodes.map(async ({ address, replaceValue }) =>
                                        await InjectValues(process.at(0).pid, address.map(i => i.address), replaceValue)));

                                    menu
                                        .data("pid", process.at(0).pid).data("address", cheatCodes); resolve({ status: true });
                                } else if (menu.find("bind").toArray().length >= 1)
                                    resolve({ status: true, address: cheatCodes });
                            } catch (err) { console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. Please check the emulator.` }); };
                        } else
                            resolve({ status: false, err: `${visual} is not ready yet.` });
                    }))();

                    menu.removeClass('injecting');
                    if (menu.find("button").toArray().length >= 1) {
                        if (data.status) {
                            if (!isHidden)
                                await alertAudio.play();
                            console.__log(`Injected ${visual} (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s).`);
                        } else
                            console.__error(data.err);
                    } else if (menu.find("bind").toArray().length >= 1) {
                        if (data.status) {
                            try {
                                const code = menu.data("n");
                                let resAddresses = data.address
                                    .map(({ address, replaceValue }) => ({
                                        replaceValue,
                                        address: address.map(({ address }) => address),
                                        currentValue: address.map(({ currentValue }) => currentValue)
                                    }));

                                const injectionAddresses = resAddresses.map(e => ([e.address, e.replaceValue])),
                                    deinjectionAddresses = resAddresses.map(e => ([e.address, e.currentValue]));
                                menu
                                    .data("code", code)
                                    .data("callback-up", async () => { try { deinjectionAddresses.map(deinjectionAddresses => InjectValues(process.at(0).pid, ...deinjectionAddresses)) } catch { }; })
                                    .data("callback-down", async () => { try { injectionAddresses.map(injectionAddresses => InjectValues(process.at(0).pid, ...injectionAddresses)) } catch { }; });

                                globalShortcut.addListener(`up-${code}`, menu.data("callback-up"));
                                globalShortcut.addListener(`down-${code}`, menu.data("callback-down"));

                                if (!isHidden)
                                    await alertAudio.play();
                                console.__log(`Injected ${visual} (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s).`);
                            } catch (err) { console.log(err); console.__error(`Please select another key, ${menu.data("name")} is already registered`); };
                        } else
                            console.__error(data.err);
                    };
                } catch (err) {
                    console.log(err);
                    console.__error(`Error while injecting ${visual}`);
                };
            } else {
                menu.removeClass('injecting');
                console.__error("Emulator not detected. Please ensure it is running.");
            }
        } else if (menu.hasClass('injected'))
            menu.removeClass('injected');
    });

    contextBridge.exposeInMainWorld("ExitPanel", () => ipcRenderer.send("ExitPanel"));
    contextBridge.exposeInMainWorld("RestartPanel", () => ipcRenderer.send("RestartPanel"));
    contextBridge.exposeInMainWorld("ToggleStreamer", async () => {
        if (!logged)
            return await ipcRenderer.invoke("reportThisUser", "Bypassed the Login Page");


        isHidden = !isHidden;
        ipcRenderer.send("HiddenStatus", isHidden);
    });

    contextBridge.exposeInMainWorld("ToggleInternet", async () => {
        if (!logged)
            return await ipcRenderer.invoke("reportThisUser", "Bypassed the Login Page");


        if (isInternetBlocked) {
            const deleteRules = (await Promise.all([
                `netsh advfirewall firewall delete rule name="FF Block In1"`,
                `netsh advfirewall firewall delete rule name="FF Block In2"`,
                `netsh advfirewall firewall delete rule name="FF Block In3"`,
                `netsh advfirewall firewall delete rule name="FF Block In4"`,
                `netsh advfirewall firewall delete rule name="FF Block In5"`,
                `netsh advfirewall firewall delete rule name="FF Block In6"`
            ]
                .map(async e => { try { execSync(e); return true; } catch (err) { console.log(err); return false; }; })));

            if (deleteRules.filter(i => !i).length == 0) {
                isInternetBlocked = false;

                if (!isHidden)
                    await alertAudio.play();
                $(".internet").removeClass("injected"); console.__log(`Internet Unblocked.`);
            } else
                console.__error("Admin access not provided.");
        } else {
            const addRules = (await Promise.all([
                `netsh advfirewall firewall add rule name="FF Block In1" dir=in action=block program="C:\\Program Files\\BlueStacks_nxt\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In1" dir=out action=block program="C:\\Program Files\\BlueStacks_nxt\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In2" dir=in action=block program="C:\\Program Files\\BlueStacks\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In2" dir=out action=block program="C:\\Program Files\\BlueStacks\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In3" dir=in action=block program="C:\\Program Files\\BlueStacks_msi2\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In3" dir=out action=block program="C:\\Program Files\\BlueStacks_msi2\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In4" dir=in action=block program="C:\\Program Files\\BlueStacks_msi5\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In4" dir=out action=block program="C:\\Program Files\\BlueStacks_msi5\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In5" dir=in action=block program="C:\\Program Data\\BlueStacks_msi5\\HD-Player.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In5" dir=out action=block program="C:\\Program Data\\BlueStacks_msi5\\HD-Player.exe"`,

                `netsh advfirewall firewall add rule name="FF Block In6" dir=in action=block program="C:\\Program Files (x86)\\SmartGaGa\\ProjectTitan\\Engine\\ProjectTitan.exe"`,
                `netsh advfirewall firewall add rule name="FF Block In6" dir=out action=block program="C:\\Program Files (x86)\\SmartGaGa\\ProjectTitan\\Engine\\ProjectTitan.exe"`
            ]
                .map(async e => { try { execSync(e); return true; } catch (err) { console.log(err); return false; }; })));

            if (addRules.filter(i => !i).length == 0) {
                isInternetBlocked = true;

                if (!isHidden)
                    await alertAudio.play();
                $(".internet").addClass("injected"); console.__log(`Internet Blocked.`);
            } else
                console.__error("Admin access not provided.");
        };
    });
});