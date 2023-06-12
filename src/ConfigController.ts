import * as vscode from 'vscode';
import { processUrl } from './Utils';

export const getToken = () => {
    const config = vscode.workspace.getConfiguration('hobot-vscode');

    const token = config.get<string>('token');
    let serviceUrl = config.get<string>('url');

    if (!token || !serviceUrl) {
        vscode.window.showErrorMessage('请先配置 Token 和 URL', '去配置').then((choice) => {
            if (choice === '去配置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'hobot-vscode');
            }
        });
    } else {
        serviceUrl = processUrl(serviceUrl);
    }
    return { token, serviceUrl };
};


export const getProjectName = () => {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectName = config.get<string>('projectName');
    return projectName;
};

export const getProjectPath = () => {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectPath = config.get<string>('projectPath');
    return projectPath;
};