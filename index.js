require("dotenv").config();

const axios = require("axios");
const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

app.command("/hb-ping", async ({ command, ack, respond }) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond({ text: `Pong!\nLatency: ${latency}ms` });
});

app.command("/hb-help", async ({ ack, respond }) => {
  await ack();
  await respond({
    text:
`Available Commands:
/hb-ping - Check bot latency
/hb-catfact - Provides a cat fact
/hb-joke - Provides a joke
/hb-weather [city] - Get current weather for a city
/hb-remind [time] [message] - Get a DM reminder (e.g. 10m, 2h, 30s)
/hb-define [word] - Look up a word definition
/hb-ship - See a random Hack Club project`
  });
});

app.command("/hb-catfact", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://catfact.ninja/fact");
    await respond({ text: `Cat Fact:\n${response.data.fact}` });
  } catch (err) {
    await respond({ text: "Failed to fetch a cat fact." });
  }
});


app.command("/hb-joke", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    await respond({
      text:
`${response.data.setup}

${response.data.punchline}`
    });
  } catch (err) {
    await respond({ text: "Failed to fetch a joke." });
  }
});

app.command("/hb-weather", async ({ command, ack, respond }) => {
  await ack();
  const city = command.text.trim();
  if (!city){
    return respond({text: "Usage example: `/hb-weather Houston`"})
  }

  try{
    const geo = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {params: {name:city, count:1}});
    if(!geo.data.results?.length){
      return respond({text: `❌ City "${city}" not found.`})
    }
    const { latitude, longitude , name, country } = geo.data.results[0];

    const weather = await axios.get("https://api.open-meteo.com/v1/forecast",{ params:{
      latitude,
      longitude,
      current:"temperature_2m,weathercode,windspeed_10m,relative_humidity_2m",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto"
      }
    });

    const c = weather.data.current;
    const codes = {
      0: "☀️ Clear",
      1: "🌤️ Mostly clear",
      2: "⛅ Partly cloudy",
      3: "☁️ Overcast",
      45: "🌫️ Foggy",
      48: "🌫️ Foggy",
      51: "🌦️ Light drizzle",
      61: "🌧️ Light rain",
      63: "🌧️ Rain",
      65: "🌧️ Heavy rain",
      71: "🌨️ Light snow",
      73: "🌨️ snow",
      80: "🌦️ Showers",
      95: "⛈️ Thunderstorm"
    };

    const condition = codes[c.weathercode] ?? "🌡️ Unknown";

    await respond({
      text: `*Weather in ${name}, ${country}*\n${condition}\n🌡️ ${c.temperature_2m}°F \n💨 ${c.windspeed_10m} mph  \n💧 ${c.relative_humidity_2m}% humidity`});
  }catch (err){
    await respond({text: "❌ Failed to fetch weather."})
  }
});

app.command("/hb-remind", async({command, ack, respond, client}) => {
  await ack();
  const parts = command.text.trim().split(" ")
  if(parts.length < 2){
    return respond({text: "Usage example: `/hb-remind 10m Drink water`"});  
  }

  const timeStr = parts[0];
  const message = parts.slice(1).join(" ");
  const match = timeStr.match(/^(\d+)(s|m|h)$/);
  if(!match){
    return respond({text: "❌ Invalid time format. Use `30s`, `5m`, or `2h`."});
  }

  const value = parseInt(match[1]);
  const unit = match[2];
  const ms = unit === "s" ? value * 1000: unit === "m" ? value * 60000 : value * 3600000;

  if (ms > 24 * 36000000){
    return respond ({text: "❌ Max reminder time is 24h."});
  }

  await respond({text: `✅ I'll remind you in ${timeStr}: "${message}"`});

  setTimeout(async () => {
      try{
        await client.chat.postMessage({
          channel: command.user_id,
          text: `⏰ Reminder: ${message}`
        })
      }catch(err){
        console.error("Reminder DM failed:", err)
      }
    }, ms);
});


app.command("/hb-define", async({command, ack, respond})=> {
  await ack();
  const word = command.text.trim();
  if (!word) return respond({text: "Usage exmaple: `/hb-define peace`"});

  try{
    const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

    const entry = res.data[0];
    const meaning = entry.meanings[0];
    const def = meaning.definitions[0];
    const phonetic = entry.phonetic ? ` ${entry.phonetic}` : "";
    const example = def.example ? `\n_"${def.example}"_` : "";
    const synonyms = def.synonyms?.length 
    ? `\n*Synonyms:* ${def.synonyms.slice(0, 4).join(", ")}` : "";

    await respond({
      text: `*${entry.word}*${phonetic}  ·  _${meaning.partOfSpeech}_\n${def.definition}${example}${synonyms}`
    });
  }catch (err){
    await respond({text: `❌ No definition found for "${word}".`})
  }
});

app.command("/hb-ship", async ({ack ,respond}) => {
  await ack();
  try{
    const res = await axios.get("https://scrapbook.hackclub.com/api/posts");
    const posts = res.data.filter(p => p.text?.trim());
    const post = posts[Math.floor(Math.random() * Math.min(posts.length, 100))];
    const user = post.user?.username ?? "unknown";
    const text = post.text.slice(0,200);
    const link = `https://scrapbook.hackclub.com/@${user}`;

    await respond({text: `🚢 *Random Ship from @${user}*\n${text}\n<${link}|View their scrapbook>`});

  }catch (err) {
    await respond({text: "❌ Couldn't fetch a ship right now."});
  }
});

(async () => {
  await app.start();
  console.log("bot is running!");
})();