// The View: the field to paste a YouTube URL, and the videos kept.

import { connect } from "@tessello/sdk";
import { mount } from "svelte";
import "../lib/base.css";
import { setLocale } from "../lib/i18n.ts";
import { connectStore, load } from "../lib/store.svelte.ts";
import { applyTheme } from "../lib/theme.ts";
import View from "./View.svelte";

const host = await connect();
setLocale(host.context.locale);
document.documentElement.lang = host.context.locale;
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
connectStore(host);
// Read again when shown: the videos may have changed while the View waited behind the Home.
host.onVisibilityChange((visible) => visible && void load());

mount(View, { target: document.body });
await load();
