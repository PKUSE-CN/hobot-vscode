import * as vscode from 'vscode';
import { CheckResultTreeDataProvider, CheckResultTreeItem, registerShowDetailsCommand, registerShowMoreModulesCommand } from './CheckResultTreeDataProvider';
import { getToken } from './ConfigController';
import { statusVerification } from './Uploader';
import path = require('path');
import { ModuleBugsTreeDataProvider, registerShowMoreBugsCommand } from './ModuleBugsTreeDataProvider';

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
    const moduleBugsProvider = new ModuleBugsTreeDataProvider(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('hobot-vscode.checkResult.refresh', () => {
            checkResultProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hobot-vscode.checkResult.showBugs', async ({ label, description, id }: CheckResultTreeItem) => {
            await moduleBugsProvider.refresh(id);
            if (moduleBugsProvider.treeView) { moduleBugsProvider.treeView.title = `组件${label}-${description}漏洞`; }
        })
    );

    // 注册显示检测历史记录的详细信息命令
    registerShowDetailsCommand(context);
    registerShowMoreModulesCommand(context, checkResultProvider);
    registerShowMoreBugsCommand(context, moduleBugsProvider);

    // 注册侧边栏
    vscode.window.registerTreeDataProvider('checkResult', checkResultProvider);
    vscode.window.registerTreeDataProvider('moduleBugs', moduleBugsProvider);

}

// This method is called when your extension is deactivated
export function deactivate() { }
