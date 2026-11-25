@echo off
rem Figma Local Bridge - removes the Claude connections. Your Figma files are not touched.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\uninstall.ps1"
