const BANNERS = [
    { banner: "items/Top-banners/banner-1.png", text: "In solitude,<br>where we are least alone.", title: "「ヨスガノソラ」", direction: "r" },
    { banner: "items/Top-banners/banner-2.png", text: "今度は自分が、<br>センパイの穴を埋めてあげたいって", title: "「サノバウィッチ」", direction: "r" },
    { banner: "items/Top-banners/banner-3.png", text: "行動とは意思だ。<br>意思とはその人の在り方だ。", title: "「ハミダシクリエイティブ」", direction: "l" },
    { banner: "items/Top-banners/banner-4.png", text: "一緒に生まれたんだし、<br>どっちが先にこはないよね", title: "「ヨスガノソラ」", direction: "l" },
    { banner: "items/Top-banners/banner-5.jpg", text: "本当に本気で何かを成し遂げるとき、<br>人はいつだって孤独です。", title: "「魔女の旅々」", direction: "l" },
    { banner: "items/Top-banners/banner-6.png", text: "一期一會", title: "「茶湯一会集」", direction: "l" },
    { banner: "items/Top-banners/banner-7.png", text: "でも音理の心は、<br>永遠にお兄ちゃんだけのもの", title: "「星空鉄道とシロの旅」", direction: "l" },
    { banner: "items/Top-banners/banner-8.png", text: "死神と、<br>お茶でもいかが？", title: "「喫茶ステラと死神の蝶」", direction: "l" },
    { banner: "items/Top-banners/banner-9.png", text: "雨は嫌いだ。この世界は、ずっと雨だ", title: "「BLEACH」", direction: "r" },
    { banner: "items/Top-banners/banner-10.png", text: "さあ、<br>私たちのデートを始めましょう。", title: "「デート・ア・ライブ」", direction: "r" },
    { banner: "items/Top-banners/banner-11.png", text: "晴れの日は気分良く、雨の日は憂鬱と教えられたら、<br>そう思い込んでしまう。雨の日だって楽しい事はあるのに。", title: "「新世紀エヴァンゲリオン」", direction: "r" },
    { banner: "items/Top-banners/banner-12.png", text: "キミのおかげで未練が生まれた", title: "「喫茶ステラと死神の蝶」", direction: "r" },
    { banner: "items/Top-banners/banner-13.png", text: "これは、<br>ゲームであっても、遊びではない。", title: "「ソードアート・オンライン」", direction: "l" },
    { banner: "items/Top-banners/banner-14.png", text: "一人ひとりに自分だけの森がある。<br>たぶん私たちはそこへ行ったことがないけれど、それはいつもそこにある。", title: "「ノルウェイの森」", direction: "l" },
    { banner: "items/Top-banners/banner-15.png", text: "心の薄汚い旅人は、一体誰か。<br>そう、私です", title: "「魔女の旅々」", direction: "r" },
    { banner: "items/Top-banners/banner-16.png", text: "俺みたいな人間は、<br>苦味を感じる資格なんてないんだ。", title: "「天使☆騒々 RE-BOOT!」", direction: "r" },
    { banner: "items/Top-banners/banner-17.png", text: "難しい現実なんて、<br>切ればいい！", title: "「ヨスガノソラ」", direction: "r" },
    { banner: "items/Top-banners/banner-18.png", text: "家族だから、<br>心配するのは当たり前でしょ", title: "「RIDDLE JOKER」", direction: "r" },
    { banner: "items/Top-banners/banner-19.png", text: "All history is man's efforts to realise ideals.", title: "「The New Order」", direction: "l" },
    { banner: "items/Top-banners/banner-20.png", text: "嘘つきというものは、<br>いつだって平然とした顔をしているものですよ", title: "「魔女の旅々」", direction: "l" },
    { banner: "items/Top-banners/banner-21.png", text: "でも、作った曲も、歌った歌も、それに込めた気持ちも、<br>聞いてくれる人がいなければ、なんの意味もありません", title: "「ハミダシクリエイティブ」", direction: "l" },
    { banner: "items/Top-banners/banner-22.png", text: "個性捨てたら、<br>死んでるのと一緒だよ。", title: "「ぼっち・ざ・ろっく！」", direction: "r" },
    { banner: "items/Top-banners/banner-23.png", text: "独りになるのが、<br>こわかった……", title: "「ヨスガノソラ」", direction: "l" },
    { banner: "items/Top-banners/banner-24.png", text: "この旅は、彼女のなかに、何を残していくのだろう。<br>そして俺に、何を与えてくれるのだろう。", title: "「星空鉄道とシロの旅」", direction: "r" },
    { banner: "items/Top-banners/banner-25.png", text: "さあまっすぐ、<br>なりたいわたしになるためにGo!", title: "「まいてつ Last Run!!」", direction: "r" },
];

const Holiday_BANNERS = [
    { banner: "items/Top-banners/Hoilday/Banner-1.jpg", text: "不自由，毋寧死！", title: "「派屈克·亨利」", direction: "r", date: "06-04" },
    { banner: "items/Top-banners/Hoilday/Banner-2.png", text: "今天，在這裡，<br>在人民的廣場上，人民的女神高高地站起來了！", title: "「民主女神宣言」", direction: "r", date: "06-04" },
    { banner: "items/Top-banners/Hoilday/Banner-3.webp", text: "英靈不朽，浩氣長存！", title: "「佚名」", direction: "l", date: "06-04" },
    { banner: "items/Top-banners/Hoilday/Banner-4.jpg", text: "如果有人問我，為甚麼要這樣做？<br>我的回答是：『It is my duty!』", title: "「佚名」", direction: "r", date: "06-04" },
    { banner: "items/Top-banners/Hoilday/Banner-5.jpg", text: "在天災人禍面前我們什麼都不是，<br>關心身邊所有人，生命好脆弱。", title: "「普羅大眾」", direction: "r", date: "11-26" },
    { banner: "items/Top-banners/Hoilday/Banner-6.webp", text: "真係活在當下，<br>今日唔知聽日事。", title: "「參與火場救援的消防員」", direction: "r", date: "11-26" },
    { banner: "items/Top-banners/Hoilday/Banner-7.webp", text: "願逝者安息，生者堅強；<br>願悲劇不再發生。", title: "「普羅大眾」", direction: "r", date: "11-26" },
    { banner: "items/Top-banners/Hoilday/Banner-8.jpg", text: "世事无常，生命脆弱，<br>灾难面前，人人皆是蝼蚁。", title: "「普羅大眾」", direction: "r", date: "11-26" },
];
const BANNER_INTERVAL = 8000;
const BANNER_TRANSITION = 550;

const bannerContainer = document.querySelector(".top-banner");
const bannerProgress = document.getElementById("banner-progress");
bannerProgress.style.setProperty("--banner-duration", `${BANNER_INTERVAL}ms`);

function preloadBanner(banner) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
            console.error("橫幅圖片載入失敗:", banner.banner);
            resolve(null);
        };
        image.src = banner.banner;
    });
}

function createBanner(banner, image) {
    const slide = document.createElement("div");
    slide.className = "banner-slide";
    image.alt = "Image-Top-Banner";
    const text = document.createElement("div");
    text.className = "banner-text" + (banner.direction === "l" || banner.direction === "L" ? " left" : "");
    const heading = document.createElement("h1");
    banner.text.split(/<br\s*\/?>/i).forEach((line, index) => {
        if (index) heading.appendChild(document.createElement("br"));
        heading.appendChild(document.createTextNode(line));
    });
    const title = document.createElement("p");
    title.textContent = banner.title;
    text.append(heading, title);
    slide.append(image, text);
    return slide;
}

function restartBannerProgress() {
    bannerProgress.style.animation = "none";
    void bannerProgress.offsetWidth;
    bannerProgress.style.animation = "";
    bannerProgress.style.animationPlayState = "running";
}

const failedBanners = new Set();
let activeBanners = [];
let bannerQueue = [];
let lastQueuedBanner = null;
let currentBanner = null;
let currentSlide = bannerContainer.querySelector(".banner-slide");
let rotationTimer;
let transitionTimer;
let dateTimer;
let isSwitchingBanner = false;
let bannerGeneration = 0;
let activeDate;
bannerProgress.style.animationPlayState = "paused";
bannerProgress.hidden = true;

function prepareBanner() {
    if (!bannerQueue.length) {
        bannerQueue = activeBanners.filter(banner => !failedBanners.has(banner));
        if (bannerQueue.length === 1 && bannerQueue[0] === currentBanner) return null;
        for (let index = bannerQueue.length - 1; index > 0; index--) {
            const random = Math.floor(Math.random() * (index + 1));
            [bannerQueue[index], bannerQueue[random]] = [bannerQueue[random], bannerQueue[index]];
        }
        if (bannerQueue.length > 1 && bannerQueue[0] === lastQueuedBanner) {
            [bannerQueue[0], bannerQueue[1]] = [bannerQueue[1], bannerQueue[0]];
        }
    }
    const banner = bannerQueue.shift();
    if (!banner) return null;
    lastQueuedBanner = banner;
    return { banner, image: preloadBanner(banner) };
}

let nextBanner;
let followingBanner;

function scheduleBannerRotation() {
    clearTimeout(rotationTimer);
    bannerProgress.hidden = !nextBanner;
    if (!nextBanner) return;
    restartBannerProgress();
    rotationTimer = setTimeout(rotateBanner, BANNER_INTERVAL);
}

async function rotateBanner() {
    if (updateBannerDate()) return;
    if (isSwitchingBanner) return;
    if (!nextBanner) return;
    isSwitchingBanner = true;
    const generation = bannerGeneration;
    clearTimeout(rotationTimer);
    bannerProgress.style.animationPlayState = "paused";
    let pending = nextBanner;
    nextBanner = null;
    while (pending) {
        const { banner } = pending;
        const image = await pending.image;
        if (generation !== bannerGeneration || updateBannerDate()) return;
        if (!image) {
            failedBanners.add(banner);
            pending = followingBanner || prepareBanner();
            followingBanner = null;
            continue;
        }
        if (banner === currentBanner) {
            pending = followingBanner || prepareBanner();
            followingBanner = null;
            continue;
        }
        const next = createBanner(banner, image);
        const previous = currentSlide;
        const firstSlide = currentBanner === null;
        currentBanner = banner;
        currentSlide = next;
        nextBanner = followingBanner || prepareBanner();
        followingBanner = null;
        if (firstSlide) {
            previous.replaceWith(next);
            isSwitchingBanner = false;
            scheduleBannerRotation();
        } else {
            previous.classList.add("leaving");
            next.classList.add("entering");
            bannerContainer.insertBefore(next, bannerProgress);
            transitionTimer = setTimeout(() => {
                if (generation !== bannerGeneration) return;
                previous.remove();
                next.classList.remove("entering");
                isSwitchingBanner = false;
                scheduleBannerRotation();
            }, BANNER_TRANSITION);
        }
        return;
    }
    bannerProgress.hidden = true;
    if (!currentBanner) {
        console.error("沒有可用的橫幅圖片。");
        currentSlide.textContent = "橫幅圖片載入失敗。";
    }
    isSwitchingBanner = false;
}

function updateBannerDate() {
    const now = Date.now();
    const tokyoTime = now + 9 * 60 * 60 * 1000;
    const date = new Date(tokyoTime).toISOString().slice(0, 10);
    if (date === activeDate) return false;
    activeDate = date;
    bannerGeneration++;
    clearTimeout(rotationTimer);
    clearTimeout(transitionTimer);
    clearTimeout(dateTimer);
    dateTimer = setTimeout(updateBannerDate, 86400000 - (tokyoTime % 86400000) + 10);
    const holidays = Holiday_BANNERS.filter(banner =>
        banner.date === date || banner.date === date.slice(5));
    const selected = holidays.length ? holidays : BANNERS;
    activeBanners = Array.from(new Map(selected.map(banner => [banner.banner, banner])).values());
    failedBanners.clear();
    bannerQueue = [];
    lastQueuedBanner = null;
    currentBanner = null;
    isSwitchingBanner = false;
    bannerProgress.hidden = true;
    bannerProgress.style.animationPlayState = "paused";
    bannerContainer.querySelectorAll(".banner-slide").forEach(slide => {
        if (slide !== currentSlide) slide.remove();
    });
    currentSlide.classList.remove("entering", "leaving");
    const loading = document.createElement("p");
    loading.setAttribute("role", "status");
    loading.textContent = "橫幅載入中…";
    currentSlide.replaceChildren(loading);
    nextBanner = prepareBanner();
    followingBanner = activeBanners.length > 1 ? prepareBanner() : null;
    rotateBanner();
    return true;
}

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateBannerDate();
});
bannerContainer.addEventListener("click", rotateBanner);
updateBannerDate();
