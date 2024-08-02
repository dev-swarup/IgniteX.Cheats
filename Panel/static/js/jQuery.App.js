let t, terminal;
window.addEventListener('contextmenu', e => e.preventDefault()); window.addEventListener("DOMContentLoaded", e => {
    t = $("div#terminal");
    terminal = document.querySelector("div#terminal");

    SetPageSize("Login");
});


setInterval(async () => $('span.time').text(GetCurrentTime()), 1000); setInterval(async () => {
    const pid = GetEmulator();
    $('span.pid').html(`PID ${pid ? `<data>${pid}</data>` : '-'}`);
}, 5000);

const addZero = n => n < 10 ? `0${n}` : `${n}`, GetCurrentTime = time => {
    const current_time = new Date(time || new Date());
    const current_hours = current_time.getHours();

    return `${addZero(current_hours > 12 ? current_hours - 12 : current_hours)}:${addZero(current_time.getMinutes())}:${addZero(current_time.getSeconds())} ${current_hours >= 12 ? 'PM' : 'AM'}`;
};


async function SetPage(name) {
    $('menu.main button').removeClass('selected');
    $(`menu.main button[name="${name}"]`).addClass('selected'); $('nav div#main').attr('page', name);
};


async function InitLogin() {
    const user = $('input#user').val();
    const pass = $('input#pass').val();

    const btn = $('main[name="LOGIN"] menu div button');
    const status = $('main[name="LOGIN"] menu div span.status');

    const svg = btn.find('svg'), span = btn.find('span'); if (svg.hasClass('hidden')) {
        if (user.length > 0 && pass.length > 0) {
            status
                .html(''); span.addClass('hidden'); svg.removeClass('hidden');


            const data = await GetLogin(user, pass); if (data.status) {
                $('span.expiry').html(`EXPIRY - ${data.data.expiry === "LIFETIME" ? "LIFETIME" : GetCurrentTime(data.data.expiry)}`);

                data.data.license.map(license => {
                    const page = $(`#${license.page}`)
                        .attr("license", "true"); $(`menu.main button[name="${license.page}"]`).attr("license", "true");

                    if (license.name === "ALL")
                        page.find(`div[license="false"]`).attr("license", "true").parent().attr("license", "true");
                    else
                        page.find(`div[name="${license.name}"]`).attr("license", "true").parent().attr("license", "true");
                });

                const FirstFeature = $('menu.main button[license="true"]').toArray(); if (FirstFeature.length > 0) {
                    $(FirstFeature.at(0)).addClass('selected');
                    $("nav div#main").attr('page', FirstFeature.at(0).getAttribute("name"));

                    t = $("div#terminal");
                    terminal = t.toArray().at(0);

                    SetPageSize("Panel");
                    $('body').attr('page', 'PANEL');
                    $('head').data('token', data.data.token);
                } else {
                    span
                        .removeClass('hidden'); svg.addClass('hidden'); status.html(`Everything is right. But, there is a mistake by the developer. Please contact him. [NO_FEATURE]`);
                };
            } else {
                span
                    .removeClass('hidden'); svg.addClass('hidden'); status.html(data.msg);
            };
        } else {
            span.removeClass('hidden'); svg
                .addClass('hidden'); status.html('Enter your Username and Password');
        };
    };
};


async function InjectMenu(name, visual) {
    $(`main[name="PANEL"] menu.location div`).removeClass('injecting');
    const menu = $(`menu.location div[name="${name}"]`); if (!menu.hasClass('injecting') && !menu.hasClass('injected')) {
        let process = GetEmulator();
        if (process) {
            process = Emulator(process); if (!process.status) {
                t
                    .append(`<span><err>Emulator is not running. Run Emulator first.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); return;
            };

            menu.addClass('injecting'); t
                .append(`<span><data>Injecting ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
            try {
                const injection = await __InjectMenu__(name, visual, process.handle, $('head').data('token'));
                if (injection.status) {
                    if (injection.data) {
                        menu.addClass('injected'); t
                            .append(`<span><data>Injected ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                    } else {
                        t
                            .append(`<span><err>Failed to inject ${visual}. Try again or check if your emulator is running in 32-Bit.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                    };
                } else {
                    t
                        .append(`<span><err>${injection.data}</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
                };
            } catch (err) {
                console.log(err);
                t
                    .append(`<span><err>Failed to download DLL file.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting');
            };
        } else {
            t
                .append(`<span><err>Emulator is not running. Run Emulator first.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); return;
        };
    } else if (menu.hasClass('injected')) {
        menu.removeClass('injected');
    };
};

const skipWarnCode = new Set();
async function InjectCheat(name, visual) {
    let process = GetEmulator(); if (process) {
        process = Emulator(process); if (!process.status) {
            t
                .append(`<span><err>Emulator is not running. Run Emulator first.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); return;
        };
        const menu = $(`div#main div[name="${name}"] div button:nth-child(1)`); if (!menu.hasClass("injecting")) {
            t
                .append(`<span><data>Injecting ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.addClass("injecting").text("INJECTING");

            try {
                const injection = await __InjectCheat__(name, visual, process.handle, $('head').data('token')); if (injection.status) {
                    menu.removeClass('injecting').text("INJECT"); t
                        .append(`<span><data>Injected ${visual}</data></span>`); terminal.scrollBy(0, terminal.scrollHeight);
                } else {
                    t
                        .append(`<span><err>${injection.msg}.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting').text("INJECT");
                };
            } catch (err) {
                console.log(err);
                t
                    .append(`<span><err>Failed to inject ${visual}.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight); menu.removeClass('injecting').text("INJECT");
            };
        };
    } else {
        t
            .append(`<span><err>Emulator is not running. Run Emulator first.</err></span>`); terminal.scrollBy(0, terminal.scrollHeight);
    };
};