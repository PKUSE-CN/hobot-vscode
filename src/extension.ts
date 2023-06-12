import * as vscode from 'vscode';
import { getToken } from './ConfigController';
import path = require('path');
import { statusVerification } from './Uploader';
import { CheckResultTreeDataProvider, registerShowDetailsCommand, registerShowMoreCommand } from './CheckResultTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    getToken();

    context.subscriptions.push(
        vscode.commands.registerCommand('hobot-vscode.checkResult.checkProject', async (uri) => {
            if (uri && uri.fsPath) {
                const folderPath = uri.fsPath;
                const folderName = path.basename(folderPath);
                // TODO 检测文件所属工作空间（不清楚需不需要判断）
                console.log(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath))?.uri.fsPath);
                // const folderName = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath))?.name;

                if (folderPath && folderName) {
                    const config = vscode.workspace.getConfiguration('hobot-vscode');
                    await config.update('projectName', folderName);
                    await config.update('projectPath', folderPath);
                    statusVerification();
                }
                else {
                    vscode.window.showErrorMessage(`文件夹${folderName}路径或名称获取异常，路径为:${folderPath}，请重试`);
                }
            }
        })
    );

    const checkResultProvider = new CheckResultTreeDataProvider();

    context.subscriptions.push(
        vscode.commands.registerCommand('cobot-sast-vscode.checkResult.refresh', () => {
            checkResultProvider.refresh();
        })
    );

    // 注册显示检测历史记录的详细信息命令
    registerShowDetailsCommand(context);
    registerShowMoreCommand(context, checkResultProvider);

    // 注册侧边栏
    vscode.window.registerTreeDataProvider('checkResult', checkResultProvider);

}

// This method is called when your extension is deactivated
export function deactivate() { }
