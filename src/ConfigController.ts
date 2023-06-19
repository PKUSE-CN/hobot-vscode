import * as vscode from 'vscode';
import { processUrl } from './Utils';
import axios from 'axios';

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

export const getProjectId = async () => {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectName = config.get<string>('projectName');
    const { serviceUrl, token } = getToken();
    try {
        const repoRes = await axios.get(`${serviceUrl}/hobot/openApi/findProject`, {
            params: {
                projectName,
                projectVersion: 'vscode'
            },
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Authorization: token,
            }
        });
        if (!repoRes.data.data?.projectId) {
            vscode.window.showErrorMessage(repoRes.data.data);
        }
        return repoRes.data.data?.projectId;
    } catch (error) {
        vscode.window.showErrorMessage('获取项目Id出错');
        console.error(error);
    }
};

export const getProjectPath = () => {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectPath = config.get<string>('projectPath');
    return projectPath;
};