// The Widget (size L): how many videos are left to watch, and the latest of them, each a way to YouTube.

import { connect } from "@tessello/sdk";
import { mount } from "svelte";
import "../lib/base.css";
import { setLocale } from "../lib/i18n.ts";
import { applyTheme } from "../lib/theme.ts";
import Widget from "./Widget.svelte";

const host = await connect();
setLocale(host.context.locale);
document.documentElement.lang = host.context.locale;
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);

mount(Widget, { target: document.body, props: { host } });
