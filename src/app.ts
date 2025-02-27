/***********************************
 * app.ts
 ***********************************/
import inquirer from "inquirer";
import * as fs from "fs";
import * as dotenv from "dotenv";
import Soundcloud from "soundcloud.ts";
import * as readlineSync from "readline-sync";

dotenv.config();

/**
 * Initialize Soundcloud.ts API client.
 * Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_OAUTH_TOKEN in your .env file.
 */
const soundcloud = new Soundcloud(
  process.env.SOUNDCLOUD_CLIENT_ID!,
  process.env.SOUNDCLOUD_OAUTH_TOKEN!
);

/**
 * Structure for each track that will be output in the CSV.
 */
interface SongData {
  title: string;
  artist: string;
  album: string;
  duration: string;
}

/**
 * Ask whether the first field (before " - ") is the Artist or the Title.
 */
async function askFieldOrder(): Promise<boolean> {
  const { fieldOrder } = await inquirer.prompt<{ fieldOrder: string }>([
    {
      type: "list",
      name: "fieldOrder",
      message:
        'In your input, is the first field (before " - ") the Artist or the Title?',
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
async function getUserInputLines(): Promise<string[]> {
  const { rawInput } = await inquirer.prompt<{ rawInput: string }>([
    {
      type: "editor",
      name: "rawInput",
      message:
        "Paste your unorganized song list in the editor that opens. Save and close to continue."
    }
  ]);
  return rawInput.split("\n").map(line => line.trim()).filter(Boolean);
}

/**
 * Remove any leading timestamp from a line.
 * This regex matches a timestamp in the format "mm:ss" or "m:ss" or "mm:ss:xx", 
 * followed by one or more whitespace characters.
 */
function stripTimestamps(line: string): string {
  return line.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, "");
}

/**
 * Parse a line using the chosen field order.
 * If the delimiter " - " exists, then:
 *   - If firstIsArtist is true, first field = Artist, remainder = Title.
 *   - Otherwise, first field = Title, remainder = Artist.
 * If no delimiter is found, treat the entire line as the title.
 */
function parseLine(line: string, firstIsArtist: boolean): { artist: string; title: string } {
  line = stripTimestamps(line);
  const parts = line.split(" - ").map(str => str.trim());
  if (parts.length < 2) {
    return { artist: "", title: parts[0] };
  }
  if (firstIsArtist) {
    return { artist: parts[0], title: parts.slice(1).join(" - ") };
  } else {
    return { title: parts[0], artist: parts.slice(1).join(" - ") };
  }
}

/**
 * Format a duration (in milliseconds) into "mm:ss".
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

/**
 * Convert a SoundCloud track object into our SongData structure.
 */
function toSongData(track: any): SongData {
  return {
    title: track.title || "Unknown Title",
    artist: track.user?.username || "Unknown Artist",
    album: track.label_name || "N/A",
    duration: formatDuration(track.duration ?? 0)
  };
}

/**
 * Fuzzy match function.
 * Normalizes strings (removing extra spaces and lowercasing) and then checks if one is contained in the other.
 */
function fuzzyMatch(input: string, target: string): boolean {
  const normInput = input.replace(/\s+/g, " ").toLowerCase().trim();
  const normTarget = target.replace(/\s+/g, " ").toLowerCase().trim();
  return normInput === normTarget || normTarget.includes(normInput) || normInput.includes(normTarget);
}

/**
 * Show a confirmation prompt comparing the user's parsed input to a SoundCloud search result.
 */
async function confirmTrackChoice(
  track: any,
  index: number,
  total: number,
  userTitle: string,
  userArtist: string
): Promise<"yes" | "no" | "exit"> {
  const trackDuration = formatDuration(track.duration);
  const trackTitle = track.title || "Unknown Title";
  const trackArtist = track.user?.username || "Unknown Artist";
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

  const { choice } = await inquirer.prompt<{ choice: "yes" | "no" | "exit" }>([
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
async function doSearch(query: string): Promise<any[] | null> {
  try {
    const searchResults = await soundcloud.tracks.search({ q: query });
    return (searchResults.collection && searchResults.collection.length > 0)
      ? searchResults.collection
      : null;
  } catch (err) {
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
async function searchTrackWithUserInvolvement(
  title: string,
  artist: string,
  firstIsArtist: boolean
): Promise<SongData | null> {
  // Helper: Build combined query based on order.
  function getCombinedQuery(order: boolean): string {
    return order ? `${artist} - ${title}` : `${title} - ${artist}`;
  }

  let currentOrder = firstIsArtist; // initial order per user choice
  // If first field is Title, we want to search as "title - artist"
  let searchAttempt = getCombinedQuery(!firstIsArtist);
  let results = await doSearch(searchAttempt);

  // Fuzzy auto-accept check on top result:
  if (results && results.length > 0) {
    const top = results[0];
    if (
      fuzzyMatch(title, top.title || "") &&
      (artist === "" || fuzzyMatch(artist, top.user?.username || "") || fuzzyMatch(artist, top.title || ""))
    ) {
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
        } else if (userChoice === "exit") {
          console.log(`User skipped track for "${searchAttempt}".\n`);
          break;
        }
      }
    }
    // No confirmed match from current results; offer fallback options.
    const { finalChoice } = await inquirer.prompt<{ finalChoice: string }>([
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
    } else if (finalChoice === "opposite") {
      currentOrder = !currentOrder;
      searchAttempt = getCombinedQuery(currentOrder);
    } else if (finalChoice === "custom") {
      const { customQuery } = await inquirer.prompt<{ customQuery: string }>([
        { type: "input", name: "customQuery", message: "Enter your custom search query:" }
      ]);
      searchAttempt = customQuery;
    } else if (finalChoice === "google") {
      const googleLink = `https://www.google.com/search?q=${encodeURIComponent(title + " " + artist)}`;
      console.log(`Try this Google search link in your browser: ${googleLink}`);
      const { customQuery } = await inquirer.prompt<{ customQuery: string }>([
        { type: "input", name: "customQuery", message: "After reviewing, enter your new custom search query:" }
      ]);
      searchAttempt = customQuery;
    } else if (finalChoice === "manual") {
      const manualData = await inquirer.prompt<{
        mTitle: string;
        mArtist: string;
        mAlbum: string;
        mDuration: string;
      }>([
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
    } else {
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
  const results: SongData[] = [];

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
