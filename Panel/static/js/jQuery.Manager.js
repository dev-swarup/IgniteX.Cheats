require("bytenode");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { version } = require("../../package.json");
const { ipcRenderer, contextBridge } = require("electron");
const { FindEmulator, InjectFile, InjectValues } = require("../../jQ/index.jsc");

let t, terminal, alert_audio = new Audio("alert.wav");
window.addEventListener('contextmenu', e => e.preventDefault()); window.addEventListener("DOMContentLoaded", () => {
    const jQuery = require("./jQuery.js"), $ = selector =>
        jQuery(typeof selector !== "string" ? selector : document.querySelectorAll(selector));

    const addZero = n => n < 10 ? `0${n}` : `${n}`, GetDate = time => {
        const current_time = new Date(time || new Date());

        return `${addZero(current_time.getDate())}-${addZero(current_time.getMonth() + 1)}-${current_time.getFullYear()}`;
    },
        GetCurrentTime = time => {
            const current_time = new Date(time || new Date());
            const current_hours = current_time.getHours();

            return `${addZero(current_hours > 12 ? current_hours - 12 : current_hours)}:${addZero(current_time.getMinutes())}:${addZero(current_time.getSeconds())} ${current_hours >= 12 ? 'PM' : 'AM'}`;
        };

    t = $("div#terminal");
    terminal = t.toArray().at(0);
    let IWantAResolve; $("bind").click(async ({ currentTarget }) => {
        const e = await (() => new Promise(resolve => {
            if (IWantAResolve) {
                IWantAResolve(false);
                IWantAResolve = resolve;
            } else
                IWantAResolve = resolve;
        }))(); if (e) {
            $(currentTarget).addClass("added").html((e.key !== " " ? e.key : "SPACE").toLocaleUpperCase());

            console.log(e);
        };
    });

    window.addEventListener("keydown", async e => {
        switch (true) {
            case e.code == "Tab":
                e.preventDefault();
        };

        if (IWantAResolve) {
            IWantAResolve(e);
            IWantAResolve = null;
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
                    const data = await ipcRenderer.invoke("WantAxios", `/account/login?user=${user}&pass=${pass}`); if (data.status) {
                        $('span.expiry').html(`EXPIRY <br> <time>${data.data.expiry === "LIFETIME" ? "LIFETIME" : `${GetCurrentTime(data.data.expiry)} ${GetDate(data.data.expiry)}`}</time>`);

                        data.data.license.map(license => {
                            const page = $(`#${license.page}`)
                                .attr("license", "true"); $(`menu.main button[name="${license.page}"]`).attr("license", "true").parent().attr("license", "true");

                            if (license.name === "ALL")
                                page.find(`div[license="false"]`).attr("license", "true").parent().attr("license", "true");
                            else
                                page.find(`div[name="${license.name}"]`).attr("license", "true").parent().attr("license", "true");
                        });

                        const FirstFeature = $('menu.main button[license="true"]').toArray(); if (FirstFeature.length > 0) {
                            $(FirstFeature.at(0)).addClass('selected');
                            $("nav div#main").parent().attr("license", "true");
                            $("nav div#main").attr('page', FirstFeature.at(0).getAttribute("name"));

                            setTimeout(async () => {
                                await alert_audio.play();
                                ipcRenderer.send("SetSize", 750, 450);

                                $('body').attr('page', 'PANEL');
                                $('head').data('token', data.data.token);
                            }, 800);
                        } else {
                            $("main[name='PANEL'] nav:first-child").addClass("BYPASS", "true");
                            setTimeout(async () => {
                                await alert_audio.play();
                                ipcRenderer.send("SetSize", 280, 300);

                                $('body').attr('page', 'PANEL');
                                $('head').data('token', data.data.token);
                            }, 800);
                        };
                    } else {
                        span
                            .removeClass('hidden'); svg.addClass('hidden'); status.html(data?.err || "Our servers are on maintenance. Keep patience, We will be back soon.");
                    };
                } catch (err) {
                    console.log(err); span.removeClass('hidden'); svg
                        .addClass('hidden'); status.html('Our servers are on maintenance. Keep patience, We will be back soon.');
                }
            } else {
                span.removeClass('hidden'); svg
                    .addClass('hidden'); status.html('Enter your Username and Password');
            };
        };
    });

    contextBridge.exposeInMainWorld("InjectMenu", async (name, visual) => {
        $(`main[name="PANEL"] menu.location div`).removeClass('injecting');
        const menu = $(`menu.location div[name="${name}"]`); if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
            let process = FindEmulator();
            if (process.length > 0) {
                menu.addClass('injecting'); t
                    .append(`<span><time>${GetCurrentTime()}</time><data>Injecting ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);

                try {
                    const current_time = (new Date()).getTime(),
                        url = path.join(os.tmpdir(), `${Buffer.from(`${name}@${version}`).toString("base64url")}.dll`); const data = await (() => new Promise(async resolve => {
                            if (!fs.existsSync(url))
                                try {
                                    const res = await ipcRenderer.invoke("WantToStoreIt", `/cheat/menu/${name}`, url, $('head').data('token')); if (res.status)
                                        resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `Failed to inject ${visual}. Try again or check your Emulator.` });
                                    else
                                        resolve(res);
                                } catch (err) { console.log(err); resolve({ status: false, err: `Failed to download the latest location menu of ${visual}.` }); }
                            else
                                try {
                                    resolve((await InjectFile(process.at(0).pid, url)) ? { status: true } : { status: false, err: `Failed to inject ${visual}. Try again or check your Emulator.` });
                                } catch { resolve({ status: false, err: `Failed to inject ${visual}. Try again or check your Emulator.` }); }
                        }))();

                    menu.removeClass('injecting'); if (data.status) {
                        await alert_audio.play(); t
                            .append(`<span><time>${GetCurrentTime()}</time><data>Injected ${visual} in (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s)</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
                    } else {
                        t
                            .append(`<span><time>${GetCurrentTime()}</time><err>${data.err}</err></span>`); terminal.scrollBy(0, terminal.scrollHeight);
                    }
                } catch (err) {
                    console.log(err); menu.removeClass('injecting'); t
                        .append(`<span><time>${GetCurrentTime()}</time><err>Failed to download the latest location menu of ${visual}.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                };
            } else {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><err>Emulator is not running. Start your Emulator.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); return;
            };
        } else if (menu.hasClass('injected'))
            menu.removeClass('injected');
    });

    const skipWarnCode = new Set();
    contextBridge.exposeInMainWorld("InjectCheat", async (name, visual) => {
        let process = FindEmulator(); if (process.length > 0) {
            const menu = $(`div#main div[name="${name}"]`); if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
                t
                    .append(`<span><time>${GetCurrentTime()}</time><data>Injecting ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.addClass("injecting");

                try {
                    const current_time = (new Date()).getTime(); const data = await (() => new Promise(async resolve => {
                        try {
                            const res = await ipcRenderer.invoke("WantAxios", `/cheat/code/${name}`, $('head').data('token')); if (res.status) {
                                const data = res.data; if (data.status || skipWarnCode.has(name)) {
                                    skipWarnCode.delete(name);
                                    try {
                                        let cheatCodes = data.data;
                                        cheatCodes = await Promise.all(cheatCodes.map(([scanValue, replaceValue]) => new Promise(async resolve => {
                                            replaceValue = Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`))); try {
                                                scanValue = scanValue
                                                    .split(" ").map(i => i == "??" ? "?" : i).join(" ");

                                                resolve({ address: await ipcRenderer.invoke("AsyncFindValues", process.at(0).pid, scanValue), replaceValue });
                                            } catch (err) { console.log(err); resolve({ address: [], replaceValue }); };
                                        })));

                                        if (cheatCodes.filter(({ address }) => address.length == 0).length > 0)
                                            return resolve({ status: false, err: `Failed to scan for ${visual}. Restart your Emulator.` });

                                        cheatCodes.map(({ address, replaceValue }) => InjectValues(process.at(0).pid, address, replaceValue));

                                        let i = 0; cheatCodes
                                            .forEach(({ address }) => address.forEach(() => i++)); resolve({ status: true, replaces: i });
                                    } catch (err) {
                                        console.log(err); resolve({ status: false, err: `Failed to scan for ${visual}.` });
                                    };
                                } else {
                                    skipWarnCode
                                        .add(name); resolve({ status: false, err: `${visual} is currently not safe to use. You can use it at your own risk by, clicking again on inject.` });
                                };
                            } else
                                resolve(res);
                        } catch (err) { console.log(err); resolve({ status: false, err: `Failed to download latest codes from our server. Try again later.` }); };
                    }))();

                    menu.removeClass('injecting'); if (data.status) {
                        await alert_audio.play(); menu.removeClass('injecting'); t
                            .append(`<span><time>${GetCurrentTime()}</time><data>Injected ${visual} in (${(((new Date()).getTime() - current_time) / 1000).toFixed()}s).</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
                    } else {
                        t
                            .append(`<span><time>${GetCurrentTime()}</time><err>${data.err}</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                    };
                } catch (err) {
                    console.log(err); menu.removeClass('injecting'); t
                        .append(`<span><time>${GetCurrentTime()}</time><err>Error while injecting ${visual}.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                };
            } else if (menu.hasClass('injected'))
                menu.removeClass('injected');
        } else {
            t
                .append(`<span><time>${GetCurrentTime()}</time><err>Emulator is not running. Start your Emulator.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight);
        };
    });
});