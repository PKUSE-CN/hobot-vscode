/* eslint-disable @typescript-eslint/naming-convention */
import axios, { AxiosProgressEvent } from 'axios';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getProjectName, getProjectPath, getToken } from './ConfigController';
import { compressFolderInTemp } from './FolderZipper';
import { getCheckStatusName } from './Utils';
import FormData = require('form-data');
import { WebSocket } from 'ws';

export const uploadAndCheckProject = async (fileStream: string, projectName: string): Promise<any> => {
    try {
        const { serviceUrl, token } = getToken();
        if (serviceUrl && token) {
            const formData = new FormData();
            const tmpfileStream = fs.createReadStream(fileStream);
            formData.append('file', tmpfileStream, { filename: `${projectName}.zip` });
            formData.append('projectName', projectName);
            formData.append('projectVersion', 'vscode');
            let previousLoaded = 0; // 用于保存上一次进度事件的 loaded 值
            let projectId = undefined;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `${projectName}正在上传`,
                cancellable: false,
            }, async (progress) => {
                // const encodedProjectName = encodeURIComponent(projectName);
                const response = await axios.post(`${serviceUrl}/hobot/openApi/createAndAnalysisProject`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': token
                    },
                    timeout: 7200000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        const loaded = progressEvent.loaded || 0;
                        const total = progressEvent.total || 100000; // 设置合适的初始值
                        const increment = loaded - previousLoaded; // 计算增量
                        const incrementComplete = (increment * 100) / total;
                        const percentCompleted = Math.round((loaded * 100) / total);
                        progress.report({ increment: incrementComplete, message: `${percentCompleted}%` });
                        previousLoaded = loaded; // 更新上一次进度事件的 loaded 值
                    },
                });
                vscode.window.showInformationMessage(response.data.msg);
                // console.log('请求成功:', response.data.data);
                projectId = await response.data.data;
            });
            return projectId;
        }
    } catch (error) {
        console.error('请求失败:', error);
    }
};

export const updateProject = async (fileStream: string, projectName: string, projectId: string) => {
    try {
        const { serviceUrl, token } = getToken();
        if (serviceUrl && token) {
            const formData = new FormData();
            formData.append('projectId', projectId);
            formData.append('importType', 'file');
            const tmpfileStream = fs.createReadStream(fileStream);
            formData.append('file', tmpfileStream, { filename: `${projectName}.zip` });
            let previousLoaded = 0; // 用于保存上一次进度事件的 loaded 值
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `${projectName}正在更新代码`,
                cancellable: false,
            }, async (progress) => {
                const response = await axios.post(`${serviceUrl}/hobot/project/originUpdate`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': token
                    },
                    timeout: 7200000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        const loaded = progressEvent.loaded || 0;
                        const total = progressEvent.total || 100000; // 设置合适的初始值
                        const increment = loaded - previousLoaded; // 计算增量
                        const incrementComplete = (increment * 100) / total;
                        const percentCompleted = Math.round((loaded * 100) / total);
                        progress.report({ increment: incrementComplete, message: `${percentCompleted}%` });
                        previousLoaded = loaded; // 更新上一次进度事件的 loaded 值
                    },
                });
                vscode.window.showInformationMessage(response.data.msg);
                // console.log('请求成功:', response);
            });
        }
    } catch (error) {
        console.error('请求失败:', error);
    }
};

export const onlyCheckProject = async (projectId: string) => {
    const { serviceUrl, token } = getToken();
    const res = await axios.get(`${serviceUrl}/hobot/project/analysisStart`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: token,
        },
        params: {
            projectId
        }
    });
    vscode.window.showInformationMessage(res.data.msg);
};

export const showCheckProgress = (projectName: string, projectId: string, analysisRate: number = -3) => {
    const { serviceUrl, token } = getToken();
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `项目${projectName}`,
    }, (progress) => {
        return new Promise<void>(async (resolve, reject) => {
            // console.log(`${serviceUrl?.replace(/^http/, 'ws')}/hobot/websocket/project${projectId}`);
            try {
                const ws = new WebSocket(`${serviceUrl?.replace(/^http/, 'ws')}/hobot/websocket/project${projectId}`, {
                    timeout: 1000,
                });
                const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
                ws.onopen = e => {
                    progress.report({ message: `等待检测`, increment: analysisRate === -3 ? 0 : analysisRate });
                    statusBar.show();
                    statusBar.text = `${projectName}：开始检测`;
                };
                let lastRate = analysisRate === -3 ? 0 : analysisRate;
                ws.onmessage = (event: any) => {
                    const message = JSON.parse(event.data);
                    const rate = JSON.parse(message[projectId]).process;
                    if (rate) {
                        const increment = rate - lastRate;
                        lastRate = rate;
                        progress.report({ message: `检测中，进度${rate}%`, increment: increment });
                        statusBar.text = `${projectName}：$(sync~spin)检测中${rate}%`;
                        if (rate === '100') {
                            progress.report({ message: `检测完成！`, increment: increment });
                            vscode.window.showInformationMessage(`${projectName}检测完成！`);
                            statusBar.text = `${projectName}：检测完成`;
                            vscode.commands.executeCommand('hobot-vscode.hobot-checkResult.refresh');
                            resolve();
                        }
                    }
                };
                ws.onclose = (e) => {
                    console.error('关闭:', e.reason);
                    if (statusBar.text !== `${projectName}：检测完成`) {
                        statusBar.text !== `${projectName}：检测出错$(error)`;
                    } else {
                        statusBar.dispose();
                    }
                    reject(e);
                };
            } catch (error) {
                console.error(error);
            }
        });
    });
};

export const statusVerification = async () => {
    const { serviceUrl, token } = getToken();
    const projectName = getProjectName();
    const projectPath = getProjectPath();
    if (serviceUrl && token && projectName && projectPath) {
        const repoRes = await axios.get(`${serviceUrl}/hobot/openApi/findProject`, {
            params: {
                projectName,
                projectVersion: 'vscode'
            },
            headers: {
                Authorization: token,
            }
        });
        if (repoRes.data.data) {
            const { projectId, analysisRate } = repoRes.data.data;
            if (analysisRate === 100) {
                const reCheck = await vscode.window.showQuickPick([
                    { label: '检测', description: '不上传重新检测' },
                    { label: '重新上传', description: '重新上传并检测' },
                    { label: '否', description: '直接获取检测结果' }
                ], {
                    title: '项目已完成检测，是否重新检测？',
                    ignoreFocusOut: true,
                });
                if (reCheck?.label === '重新上传') {
                    const  [tmpZipPath, cleanupCallback]  = await compressFolderInTemp(projectPath);
                    tmpZipPath && await updateProject(tmpZipPath, projectName, projectId);
                    cleanupCallback();
                    onlyCheckProject(projectId);
                    showCheckProgress(projectName, projectId, analysisRate);
                    return;
                } else if (reCheck?.label === '检测') {
                    onlyCheckProject(projectId);
                    showCheckProgress(projectName, projectId, analysisRate);
                    return;
                } else {
                    vscode.commands.executeCommand('hobot-vscode.hobot-checkResult.refresh');
                    return;
                }
            } else if (analysisRate >= 0 || analysisRate < 100 || analysisRate === -3) {
                showCheckProgress(projectName, projectId, analysisRate);
            } else {
                const reUpload = await vscode.window.showQuickPick([
                    { label: '是' },
                    { label: '否', description: '进行检测' }
                ], {
                    title: `项目${getCheckStatusName(analysisRate)}，是否重新上传？`,
                    ignoreFocusOut: true,
                });
                if (reUpload?.label === '是') {
                    const [tmpZipPath, cleanupCallback] = await compressFolderInTemp(projectPath);
                    tmpZipPath && await updateProject(tmpZipPath, projectName, projectId);
                    cleanupCallback()
                }
                onlyCheckProject(projectId);
                showCheckProgress(projectName, projectId, analysisRate);
            }
        } else {
            const [tmpZipPath, cleanupCallback] = await compressFolderInTemp(projectPath);
            if (tmpZipPath) {
                const projectId = await uploadAndCheckProject(tmpZipPath, projectName);
                cleanupCallback();
                showCheckProgress(projectName, projectId);
            }
        }
    }
};