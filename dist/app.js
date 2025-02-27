"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/***********************************
 * app.ts
 ***********************************/
const inquirer_1 = __importDefault(require("inquirer"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
const soundcloud_ts_1 = __importDefault(require("soundcloud.ts"));
const readlineSync = __importStar(require("readline-sync"));
dotenv.config();
/**
 * Initialize Soundcloud.ts API client.
 * Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_OAUTH_TOKEN in your .env file.
 */
const soundcloud = new soundcloud_ts_1.default(process.env.SOUNDCLOUD_CLIENT_ID, process.env.SOUNDCLOUD_OAUTH_TOKEN);
/**
 * Ask whether the first field (before " - ") is the Artist or the Title.
 */
async function askFieldOrder() {
    const { fieldOrder } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "fieldOrder",
            message: 'In your input, is the first field (before " - ") the Artist or the Title?',
            choices: [
                { name: "Artist", value: "artist" },
                { name: "Title", value: "title" }
            ]
        }
    ]);
    return fieldOrder === "artist"; // true if first field is Artist
}
/**
 * Prompt the user with an editor to paste the multi-line song list.
 */
async function getUserInputLines() {
    const { rawInput } = await inquirer_1.default.prompt([
        {
            type: "editor",
            name: "rawInput",
            message: "Paste your unorganized song list in the editor that opens. Save and close to continue."
        }
    ]);
    return rawInput.split("\n").map(line => line.trim()).filter(Boolean);
}
/**
 * Remove any leading timestamp from a line.
 * This regex matches a timestamp in the format "mm:ss" or "m:ss" or "mm:ss:xx",
 * followed by one or more whitespace characters.
 */
function stripTimestamps(line) {
    return line.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, "");
}
/**
 * Parse a line using the chosen field order.
 * If the delimiter " - " exists, then:
 *   - If firstIsArtist is true, first field = Artist, remainder = Title.
 *   - Otherwise, first field = Title, remainder = Artist.
 * If no delimiter is found, treat the entire line as the title.
 */
function parseLine(line, firstIsArtist) {
    line = stripTimestamps(line);
    const parts = line.split(" - ").map(str => str.trim());
    if (parts.length < 2) {
        return { artist: "", title: parts[0] };
    }
    if (firstIsArtist) {
        return { artist: parts[0], title: parts.slice(1).join(" - ") };
    }
    else {
        return { title: parts[0], artist: parts.slice(1).join(" - ") };
    }
}
/**
 * Format a duration (in milliseconds) into "mm:ss".
 */
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
/**
 * Convert a SoundCloud track object into our SongData structure.
 */
function toSongData(track) {
    var _a, _b;
    return {
        title: track.title || "Unknown Title",
        artist: ((_a = track.user) === null || _a === void 0 ? void 0 : _a.username) || "Unknown Artist",
        album: track.label_name || "N/A",
        duration: formatDuration((_b = track.duration) !== null && _b !== void 0 ? _b : 0)
    };
}
/**
 * Fuzzy match function.
 * Normalizes strings (removing extra spaces and lowercasing) and then checks if one is contained in the other.
 */
function fuzzyMatch(input, target) {
    const normInput = input.replace(/\s+/g, " ").toLowerCase().trim();
    const normTarget = target.replace(/\s+/g, " ").toLowerCase().trim();
    return normInput === normTarget || normTarget.includes(normInput) || normInput.includes(normTarget);
}
/**
 * Show a confirmation prompt comparing the user's parsed input to a SoundCloud search result.
 */
async function confirmTrackChoice(track, index, total, userTitle, userArtist) {
    var _a;
    const trackDuration = formatDuration(track.duration);
    const trackTitle = track.title || "Unknown Title";
    const trackArtist = ((_a = track.user) === null || _a === void 0 ? void 0 : _a.username) || "Unknown Artist";
    const trackLink = track.permalink_url || "(no link)";
    console.log(`\n--- Search result [${index}/${total}] ---`);
    console.log("Your Input:");
    console.log(`  Title:  "${userTitle}"`);
    console.log(`  Artist: "${userArtist}"`);
    console.log("SoundCloud Result:");
    console.log(`  Title:    ${trackTitle}`);
    console.log(`  Artist:   ${trackArtist}`);
    console.log(`  Duration: ${trackDuration}`);
    console.log(`  Link:     ${trackLink}\n`);
    const { choice } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "choice",
            message: "Is this the correct track?",
            choices: [
                { name: "Yes (use this track)", value: "yes" },
                { name: "No (show next result)", value: "no" },
                { name: "Exit (skip this track)", value: "exit" }
            ]
        }
    ]);
    return choice;
}
/**
 * Perform a SoundCloud search with the given query.
 */
async function doSearch(query) {
    try {
        const searchResults = await soundcloud.tracks.search({ q: query });
        return (searchResults.collection && searchResults.collection.length > 0)
            ? searchResults.collection
            : null;
    }
    catch (err) {
        console.error("Error searching SoundCloud:", err);
        return null;
    }
}
/**
 * Search for a track with user involvement.
 * Initially uses the combined query in the order determined by the user's field order.
 * If no results are confirmed, offers fallback options:
 *   - Search only by title.
 *   - Search using the opposite field order.
 *   - Enter a custom search query.
 *   - Open a Google search link then enter a custom query.
 *   - Manually enter track data.
 *   - Skip the track.
 * Fuzzy matching is applied to auto-accept close matches.
 */
async function searchTrackWithUserInvolvement(title, artist, firstIsArtist) {
    var _a;
    // Helper: Build combined query based on order.
    function getCombinedQuery(order) {
        return order ? `${artist} - ${title}` : `${title} - ${artist}`;
    }
    let currentOrder = firstIsArtist; // initial order per user choice
    // If first field is Title, we want to search as "title - artist"
    let searchAttempt = getCombinedQuery(!firstIsArtist);
    let results = await doSearch(searchAttempt);
    // Fuzzy auto-accept check on top result:
    if (results && results.length > 0) {
        const top = results[0];
        if (fuzzyMatch(title, top.title || "") &&
            (artist === "" || fuzzyMatch(artist, ((_a = top.user) === null || _a === void 0 ? void 0 : _a.username) || "") || fuzzyMatch(artist, top.title || ""))) {
            console.log(`Auto-accepted fuzzy match for "${searchAttempt}".\n`);
            return toSongData(top);
        }
    }
    // Loop until a track is confirmed or the user chooses to skip.
    while (true) {
        if (results && results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                const track = results[i];
                const userChoice = await confirmTrackChoice(track, i + 1, results.length, title, artist);
                if (userChoice === "yes") {
                    return toSongData(track);
                }
                else if (userChoice === "exit") {
                    console.log(`User skipped track for "${searchAttempt}".\n`);
                    break;
                }
            }
        }
        // No confirmed match from current results; offer fallback options.
        const { finalChoice } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "finalChoice",
                message: `No confirmed match for "${searchAttempt}". Choose a fallback option:`,
                choices: [
                    { name: "Search only by the title", value: "onlyTitle" },
                    { name: "Search using the opposite field order", value: "opposite" },
                    { name: "Enter a custom search query", value: "custom" },
                    { name: "Open a Google search link then enter a custom query", value: "google" },
                    { name: "Manually enter track data", value: "manual" },
                    { name: "Skip this track", value: "skip" }
                ]
            }
        ]);
        if (finalChoice === "onlyTitle") {
            searchAttempt = title;
        }
        else if (finalChoice === "opposite") {
            currentOrder = !currentOrder;
            searchAttempt = getCombinedQuery(currentOrder);
        }
        else if (finalChoice === "custom") {
            const { customQuery } = await inquirer_1.default.prompt([
                { type: "input", name: "customQuery", message: "Enter your custom search query:" }
            ]);
            searchAttempt = customQuery;
        }
        else if (finalChoice === "google") {
            const googleLink = `https://www.google.com/search?q=${encodeURIComponent(title + " " + artist)}`;
            console.log(`Try this Google search link in your browser: ${googleLink}`);
            const { customQuery } = await inquirer_1.default.prompt([
                { type: "input", name: "customQuery", message: "After reviewing, enter your new custom search query:" }
            ]);
            searchAttempt = customQuery;
        }
        else if (finalChoice === "manual") {
            const manualData = await inquirer_1.default.prompt([
                { type: "input", name: "mTitle", message: "Enter the track title:" },
                { type: "input", name: "mArtist", message: "Enter the artist name:" },
                { type: "input", name: "mAlbum", message: "Enter the album name (or 'N/A'):", default: "N/A" },
                { type: "input", name: "mDuration", message: "Enter the track duration (e.g. 3:15):", default: "0:00" }
            ]);
            return {
                title: manualData.mTitle,
                artist: manualData.mArtist,
                album: manualData.mAlbum,
                duration: manualData.mDuration
            };
        }
        else {
            console.log(`Skipping track for "${searchAttempt}".\n`);
            return null;
        }
        results = await doSearch(searchAttempt);
    }
}
/**
 * Main flow:
 * 1. Ask for field order (first field is Artist or Title).
 * 2. Get multi-line input via an editor.
 * 3. For each line, parse (removing timestamps) and search.
 * 4. Collect confirmed SongData.
 * 5. Ask for the playlist name (via readline-sync).
 * 6. Write the CSV file.
 */
async function main() {
    const firstIsArtist = await askFieldOrder();
    const lines = await getUserInputLines();
    const results = [];
    for (const line of lines) {
        const { artist, title } = parseLine(line, firstIsArtist);
        const finalSong = await searchTrackWithUserInvolvement(title, artist, firstIsArtist);
        if (finalSong) {
            results.push(finalSong);
        }
    }
    const playlistName = readlineSync.question("What should the playlist be named? ");
    let csvContent = `"Title","Artist","Album","Duration"\n`;
    for (const song of results) {
        const safeTitle = song.title.replace(/"/g, '""');
        const safeArtist = song.artist.replace(/"/g, '""');
        const safeAlbum = song.album.replace(/"/g, '""');
        csvContent += `"${safeTitle}","${safeArtist}","${safeAlbum}","${song.duration}"\n`;
    }
    fs.writeFileSync(`${playlistName}.csv`, csvContent, { encoding: "utf8" });
    console.log(`\nSaved CSV as "${playlistName}.csv".`);
}
main().catch(err => console.error(err));
