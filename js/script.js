// Audio state
let currentsong = new Audio();
let music = [];        // current playlist (array of filenames only)
let currfolder = "";   // current folder name
let songs = [];        // same as music; kept for compatibility

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

// Normalize any URL/path (decode, backslashes -> slashes, collapse multiple slashes)
function normalizeUrlPath(href) {
  try {
    return decodeURI(href).replace(/\\/g, "/").replace(/\/+/g, "/");
  } catch {
    return String(href).replace(/\\/g, "/").replace(/\/+/g, "/");
  }
}

// Extract the filename (last path segment) from a URL
function getFileNameFromHref(href) {
  const norm = normalizeUrlPath(href);
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

// Build a safe folder segment
function safeFolder(folder) {
  return String(folder).replace(/\\/g, "/");
}

// Render songs list from scratch
function renderSongList(list) {
  const ul = document.querySelector(".songlist ul");
  if (!ul) return;
  ul.innerHTML = "";

  for (const file of list) {
    // Clean presentation name only for display
    const songname1 = file
      .replaceAll("%20", " ")
      .replaceAll("_", " ")
      .replaceAll("(MP3160K)", "")
      .replaceAll("(Official Music Video)", "");

    ul.innerHTML += `
      <li>
        <img class="invert" src="img/mlib.svg" height="30" alt="">
        <div class="info">
          <div class="sname">${songname1}</div>
          <div class="sartist"></div>
        </div>
        <div class="lplay">
          <span>playnow</span>
          <img src="img/play.svg" height="25" alt="">
        </div>
      </li>`;
  }

  // Rebind click handlers
  Array.from(document.querySelectorAll(".songlist li")).forEach(li => {
    li.addEventListener("click", () => {
      const trackDisplay = li.querySelector(".info .sname").textContent.trim();
      // Find the actual filename that matches this display name best (fallback exact match if unchanged)
      // Since display name removed decorations, try to match by ignoring those decorations again
      const match = music.find(f => {
        const cleaned = f
          .replaceAll("%20", " ")
          .replaceAll("_", " ")
          .replaceAll("(MP3160K)", "")
          .replaceAll("(Official Music Video)", "");
        return cleaned.trim() === trackDisplay;
      }) || music.find(f => f.trim() === trackDisplay) || music[0];

      if (match) playMusic(match);
    });
  });
}

// Fetch and parse songs from a folder directory listing
async function getsongs(folder) {
  currfolder = folder;

  const resp = await fetch(`http://127.0.0.1:3000/songs/${encodeURIComponent(folder)}/`);
  const html = await resp.text();

  const div = document.createElement("div");
  div.innerHTML = html;

  // Collect .mp3 links from anchor tags
  const anchors = div.getElementsByTagName("a");
  const found = [];
  for (let i = 0; i < anchors.length; i++) {
    const href = anchors[i].href || "";
    const norm = normalizeUrlPath(href);
    if (norm.toLowerCase().endsWith(".mp3")) {
      const file = getFileNameFromHref(norm);
      if (file) found.push(file);
    }
  }

  // Unique and assign
  songs = Array.from(new Set(found));
  music = songs.slice();

  // Render UI
  renderSongList(songs);

  return songs;
}

// Play a track by filename (not display name)
const playMusic = (track, pause = false) => {
  const folder = safeFolder(currfolder);
  // Ensure forward slashes only
  currentsong.src = `/songs/${folder}/${track}`.replace(/\\/g, "/").replace(/\/+/g, "/");

  if (!pause) {
    currentsong.play();
    const playBtn = document.getElementById("play") || window.play;
    if (playBtn) playBtn.src = "img/mpause.svg";
  }

  const sinfo = document.querySelector(".sinfo");
  if (sinfo) sinfo.textContent = decodeURI(track);

  const stime = document.querySelector(".stime");
  if (stime) stime.textContent = "00:00/00:00";
};

// Build album cards from /songs/ directory listing
async function displayAlbums() {
  const s = await fetch(`http://127.0.0.1:3000/songs/`);
  const res = await s.text();
  const div = document.createElement("div");
  div.innerHTML = res;

  const anchors = Array.from(div.getElementsByTagName("a"));
  const dirs = anchors
    .map(a => normalizeUrlPath(a.href || ""))
    .filter(href => href.includes("/songs/"))
    .map(href => {
      const parts = href.split("/").filter(Boolean);
      const idx = parts.indexOf("songs");
      return idx >= 0 ? parts[idx + 1] : "";
    })
    .filter(Boolean)
    .filter(name => name !== "." && name !== "..");

  const uniqueDirs = Array.from(new Set(dirs));

  const cardcontainer = document.querySelector(".cardcontainer");
  if (!cardcontainer) return;
  cardcontainer.innerHTML = "";

  for (const folder of uniqueDirs) {
    try {
      const metaResp = await fetch(`http://127.0.0.1:3000/songs/${encodeURIComponent(folder)}/info.json`);
      const meta = await metaResp.json();
      cardcontainer.innerHTML += `
        <div data-folder="${folder}" class="card">
          <div class="play"><img src="img/play.svg" height="30" alt=""></div>
          <img src="/songs/${folder}/cover.jpeg" alt="">
          <h2>${meta.title}</h2>
          <p>${meta.description}</p>
        </div>`;
    } catch {
      // If no info.json, still create a minimal card
      cardcontainer.innerHTML += `
        <div data-folder="${folder}" class="card">
          <div class="play"><img src="img/play.svg" height="30" alt=""></div>
          <img src="/songs/${folder}/cover.jpeg" alt="">
          <h2>${folder}</h2>
          <p></p>
        </div>`;
    }
  }

  // Click to load album; avoid reloading same folder
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", async e => {
      const folder = e.currentTarget.dataset.folder;
      if (folder !== currfolder) {
        const list = await getsongs(folder);
        if (list.length > 0) playMusic(list[0]);
      } else if (music.length > 0) {
        playMusic(music[0]);
      }
    });
  });
}

async function main() {
  // Initial load: either comment the next two lines if you want to start empty,
  // or keep them to auto-load a default folder once.
  await getsongs("itemsongs");
  if (songs.length > 0) playMusic(songs[0], true);

  // Display albums
  displayAlbums();

  // Controls
  const playBtn = document.getElementById("play") || window.play;
  const previousBtn = document.getElementById("previous") || window.previous;
  const nextBtn = document.getElementById("next") || window.next;

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (currentsong.paused) {
        currentsong.play();
        playBtn.src = "img/mpause.svg";
      } else {
        currentsong.pause();
        playBtn.src = "img/mplay.svg";
      }
    });
  }

  // Time updates
  currentsong.addEventListener("timeupdate", () => {
    const stime = document.querySelector(".stime");
    if (stime) stime.textContent = `${formatTime(currentsong.currentTime)}/${formatTime(currentsong.duration)}`;

    const circle = document.querySelector(".circle");
    if (circle && currentsong.duration > 0) {
      circle.style.left = (currentsong.currentTime / currentsong.duration) * 100 + "%";
    }
  });

  // Seekbar
  const seekbar = document.querySelector(".seekbar");
  if (seekbar) {
    seekbar.addEventListener("click", e => {
      const rect = seekbar.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percent = (offsetX / rect.width) * 100;

      const circle = document.querySelector(".circle");
      if (circle) circle.style.left = percent + "%";

      if (!isNaN(currentsong.duration) && currentsong.duration > 0) {
        currentsong.currentTime = (currentsong.duration * percent) / 100;
      }

      const stime = document.querySelector(".stime");
      if (stime) stime.textContent =
        `${formatTime(currentsong.currentTime)}/${formatTime(currentsong.duration)}`;
    });
  }

  // Sidebar toggles
  const hamburger = document.querySelector(".hamburger");
  const closeBtn = document.querySelector(".close");
  if (hamburger) hamburger.addEventListener("click", () => { document.querySelector(".left").style.left = "0px"; });
  if (closeBtn) closeBtn.addEventListener("click", () => { document.querySelector(".left").style.left = "-100%"; });

  // Previous/Next
  if (previousBtn) {
    previousBtn.addEventListener("click", () => {
      const currentFile = normalizeUrlPath(currentsong.src).split("/").pop();
      const index = music.indexOf(currentFile);
      if ((index - 1) >= 0) playMusic(music[index - 1]);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const currentFile = normalizeUrlPath(currentsong.src).split("/").pop();
      const index = music.indexOf(currentFile);
      if ((index + 1) < music.length) playMusic(music[index + 1]);
    });
  }

  // Volume slider
  const rangeInput = document.querySelector(".range input");
  if (rangeInput) {
    rangeInput.addEventListener("change", e => {
      currentsong.volume = parseInt(e.target.value, 10) / 100;
    });
  }

  // Mute toggle
  const volIcon = document.querySelector(".volume > img");
  if (volIcon) {
    volIcon.addEventListener("click", e => {
      const target = e.target;
      if (target.src.includes("volume.svg")) {
        target.src = target.src.replace("volume.svg", "mute.svg");
        currentsong.volume = 0;
        if (rangeInput) rangeInput.value = 0;
      } else {
        target.src = target.src.replace("mute.svg", "volume.svg");
        currentsong.volume = 0.2;
        if (rangeInput) rangeInput.value = 20;
      }
    });
  }
}

main();
