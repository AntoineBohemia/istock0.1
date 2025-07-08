"use client";

import ReactGA from "react-ga4";

import { useEffect } from "react";

export default function GoogleAnalyticsInit() {
  useEffect(() => {
    ReactGA.initialize(`${process.env.GA_KEY}`);
    ReactGA.send("pageview");
  });

  return null;
}
