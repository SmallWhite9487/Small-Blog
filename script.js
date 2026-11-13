// ===== 目標清單 =====
var TARGETS = [
    { date: "2027-01-01", name: "新年" },
    { date: "2028-03-16", name: "語校畢業" },
    { date: "2032-03-31", name: "正式畢業" },
    { date: "2035-04-30", name: "「治療」", secret: true },
    { date: "2036-03-27", name: "「新生」", secret: true },
];

// ===== 隱藏模式 =====
var secretMode = false;
var DEFAULT_NAME =
    "<ruby>Terry <rt>テリー</rt></ruby> <ruby>Weng<rt>オウ</rt></ruby>";
var SECRET_NAME =
    "<ruby>天音<rt>あまね</rt></ruby> <ruby>千穹<rt>ちそら</rt></ruby>";
var DEFAULT_BIO = "Small White・He/His";
var SECRET_BIO = "Small White・She/Her";

// ===== 時間格式化 =====
var timeFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour12: false,
    hour: "2-digit", minute: "2-digit", second: "2-digit"
});
var dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" });

function daysUntil(dateStr, today) {
    var t = dateStr.split("-");
    return Math.round(
        (Date.UTC(+t[0], +t[1] - 1, +t[2]) -
         Date.UTC(+today[0], +today[1] - 1, +today[2])) / 86400000
    );
}

function updateClock() {
    var now = new Date();
    document.getElementById("tokyo-time").textContent = timeFmt.format(now);

    var today = dateFmt.format(now).split("-");
    var rows = TARGETS.filter(function (t) {
        return secretMode || !t.secret;
    }).map(function (t) {
        var days = daysUntil(t.date, today);
        var text;
        if (days > 0)        text = "距離 " + t.name + " 還有 <strong>" + days + "</strong> 天";
        else if (days === 0) text = t.name + " 就是今天！";
        else                 text = t.name + " 已過 <strong>" + (-days) + "</strong> 天";
        return "<div class=\"countdown-row\">" + text + "</div>";
    });
    document.getElementById("countdown").innerHTML = rows.join("");
}

document.getElementById("secret-toggle").addEventListener("click", function () {
    secretMode = !secretMode;
    document.getElementById("profile-name").innerHTML =
        secretMode ? SECRET_NAME : DEFAULT_NAME;
    document.getElementById("profile-bio").innerHTML =
        secretMode ? SECRET_BIO : DEFAULT_BIO;
    document.getElementById("name-divider").classList.toggle("trans", secretMode);
    updateClock();
});

updateClock();
setInterval(updateClock, 1000);
