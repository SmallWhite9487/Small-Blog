const BANNERS = [
    { banner: "items/Top-Banner-1.jpg", text: "In solitude,<br>where we are least alone.", title: "「ヨスガノソラ」", direction: "r" },
    { banner: "items/Top-Banner-2.png", text: "今度は自分が、<br>センパイの穴を埋めてあげたいって", title: "「サノバウィッチ」", direction: "r" },
    { banner: "items/Top-Banner-3.png", text: "行動とは意思だ。<br>意思とはその人の在り方だ。", title: "「ハミダシクリエイティブ」", direction: "l" },
    { banner: "items/Top-Banner-4.png", text: "一緒に生まれたんだし、<br>どっちが先にこはないよね", title: "「春日 野穹」", direction: "l" },
    { banner: "items/Top-Banner-5.jpg", text: "本当に本気で何かを成し遂げるとき、<br>人はいつだって孤独です。", title: "「魔女の旅々」", direction: "l" },
];
const BANNER_INTERVAL = 8000;
const BANNER_TRANSITION = 550;

const bannerContainer = document.querySelector(".top-banner");
const bannerProgress = document.getElementById("banner-progress");
bannerProgress.style.setProperty("--banner-duration", `${BANNER_INTERVAL}ms`);

function preloadBanner(banner) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(banner);
        image.onerror = () => {
            console.error("橫幅圖片載入失敗:", banner.banner);
            resolve(null);
        };
        image.src = banner.banner;
    });
}

function createBanner(banner) {
    const slide = document.createElement("div");
    slide.className = "banner-slide";
    const image = document.createElement("img");
    image.src = banner.banner;
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
}

Promise.all(BANNERS.map(preloadBanner)).then(results => {
    const available = results.filter(Boolean);
    if (!available.length) {
        console.error("沒有可用的橫幅圖片。");
        return;
    }

    let currentIndex = Math.floor(Math.random() * available.length);
    let current = createBanner(available[currentIndex]);
    bannerContainer.querySelector(".banner-slide").replaceWith(current);

    if (available.length < 2) {
        bannerProgress.style.animation = "none";
        bannerProgress.style.clipPath = "inset(0)";
        return;
    }

    function rotateBanner() {
        let nextIndex = Math.floor(Math.random() * (available.length - 1));
        if (nextIndex >= currentIndex) nextIndex++;
        currentIndex = nextIndex;
        const next = createBanner(available[currentIndex]);
        const previous = current;
        previous.classList.add("leaving");
        next.classList.add("entering");
        bannerContainer.insertBefore(next, bannerProgress);
        current = next;
        restartBannerProgress();
        setTimeout(() => {
            previous.remove();
            next.classList.remove("entering");
        }, BANNER_TRANSITION);
        setTimeout(rotateBanner, BANNER_INTERVAL);
    }

    restartBannerProgress();
    setTimeout(rotateBanner, BANNER_INTERVAL);
});
