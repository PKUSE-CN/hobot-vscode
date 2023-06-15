/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
const levels = [
    { key: 1, value: "high" },
    { key: 2, value: "mid" },
    { key: 3, value: "low" },
    { key: 4, value: "other" },
];

const levelColor: Record<string, string> = {
    high: "level.high",
    mid: "level.mid",
    low: "level.low",
    other: "level.other",
};

export const getLevelColor = (level: string) => {
    return new vscode.ThemeColor(levelColor[level]);
};

const colorList = [
    "#C82B33",
    "#FE7178",
    "#FF989E",
    "#A89595",
];

const numberLevel = {
    1: "高危",
    2: "中危",
    3: "低危",
    4: "其他",
};

const numberColor = {
    1: "#C82B33",
    2: "#FE7178",
    3: "#FF989E",
    4: "#A89595",
};

export { levels, levelColor, colorList, numberLevel, numberColor };
