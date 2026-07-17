-- Fix: remove the stale 1-argument overload of get_technicians_with_stats.
--
-- Migration 20260717300000 added a p_year parameter via CREATE OR REPLACE, but
-- because the argument signature changed (uuid -> uuid, int) Postgres kept the
-- OLD single-argument function instead of replacing it. The database therefore
-- had TWO overloads:
--   get_technicians_with_stats(uuid)         -- old
--   get_technicians_with_stats(uuid, int)    -- new
--
-- Callers that pass only the organization id (no year) became ambiguous and
-- silently returned nothing (equipment assign modal, stock exit, movements,
-- scan, quick movement, technician inventory, mobile technicians list...).
--
-- Dropping the old overload leaves a single function; the 2-arg version has
-- p_year DEFAULT NULL (falls back to the current year), so every call — with or
-- without a year — now resolves unambiguously.

DROP FUNCTION IF EXISTS get_technicians_with_stats(uuid);
