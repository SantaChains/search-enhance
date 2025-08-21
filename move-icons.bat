@echo off
echo Moving downloaded icons to icons folder...

if exist "%USERPROFILE%\Downloads\icon-16.png" (
    move "%USERPROFILE%\Downloads\icon-16.png" "icons\icon-16.png"
    echo Moved icon-16.png
)

if exist "%USERPROFILE%\Downloads\icon-32.png" (
    move "%USERPROFILE%\Downloads\icon-32.png" "icons\icon-32.png"
    echo Moved icon-32.png
)

if exist "%USERPROFILE%\Downloads\icon-48.png" (
    move "%USERPROFILE%\Downloads\icon-48.png" "icons\icon-48.png"
    echo Moved icon-48.png
)

if exist "%USERPROFILE%\Downloads\icon-128.png" (
    move "%USERPROFILE%\Downloads\icon-128.png" "icons\icon-128.png"
    echo Moved icon-128.png
)

echo Done! Please check the icons folder.
pause