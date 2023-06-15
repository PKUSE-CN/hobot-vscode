/* eslint-disable @typescript-eslint/naming-convention */
import axios from 'axios';
import * as vscode from 'vscode';
import { getProjectId, getProjectName, getToken } from './ConfigController';
import { getLevelColor } from './defectLevel';
import path = require('path');
import * as tmp from 'tmp';
import * as fs from 'fs';
import humanizeDuration = require('humanize-duration');

const getHighestLevel = (module: any) => {
    if (module.bug_high > 0) {
        return 'high';
    } else if (module.bug_middle > 0) {
        return 'middle';
    } else if (module.bug_low > 0) {
        return 'low';
    } else if (module.bug_other > 0) {
        return 'other';
    }
    return null;
};

export class CheckResultTreeItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly description: string,
        public readonly collapsible: vscode.TreeItemCollapsibleState,
        public readonly originData?: any,
    ) {
        super(label, collapsible);

        if (originData) {
            const highestLevel = getHighestLevel(this.originData);
            if (highestLevel) {
                this.contextValue = 'hasBug';
                this.iconPath = new vscode.ThemeIcon('extensions', getLevelColor(highestLevel));
            } else {
                this.iconPath = new vscode.ThemeIcon('extensions');
            }
            const tooltip = new vscode.MarkdownString();
            tooltip.supportThemeIcons = true;
            tooltip.appendMarkdown(`**${this.originData.module_name}**: ${this.originData.module_version}\n\n`);
            tooltip.appendMarkdown(`**组件来源**: [${this.originData.module_origin}](${this.originData.module_url})\n\n`);
            tooltip.appendMarkdown(`**已知漏洞**: ${this.originData.module_bugcount}\n\n`);
            this.originData.bug_high && tooltip.appendMarkdown(`**🔴 高危漏洞**: ${this.originData.bug_high}\n\n`);
            this.originData.bug_middle && tooltip.appendMarkdown(`**🟠 中危漏洞**: ${this.originData.bug_middle}\n\n`);
            this.originData.bug_low && tooltip.appendMarkdown(`**🟡 低危漏洞**: ${this.originData.bug_low}\n\n`);
            this.originData.bug_other && tooltip.appendMarkdown(`**🔵 其他漏洞**: ${this.originData.bug_other}\n\n`);
            tooltip.appendMarkdown(`**推荐版本**: ${this.originData.module_upversion || "暂无"}`);
            this.originData.module_updatetime && tooltip.appendMarkdown('，' + humanizeDuration(Date.now() - new Date(this.originData.module_updatetime).getTime(), {
                language: 'zh_CN',
                largest: 2,
                round: true,
                units: ['y', 'mo', 'w', 'd', 'h', 'm'],
                conjunction: " ",
                serialComma: false
            }) + '前发布');
            tooltip.appendMarkdown(`\n\n **最新版本**: ${this.originData.module_newestversion || "暂无"}`);
            this.originData.module_newesttime && tooltip.appendMarkdown('，' + humanizeDuration(Date.now() - new Date(this.originData.module_newesttime).getTime(), {
                language: 'zh_CN',
                largest: 2,
                round: true,
                units: ['y', 'mo', 'w', 'd', 'h', 'm'],
                conjunction: " ",
                serialComma: false
            }) + '前发布\n\n');
            this.tooltip = tooltip;
        } else {
            this.tooltip = this.description;
        }

        if (this.id === 'showMore') {
            this.command = {
                title: '获取更多',
                command: 'hobot.checkResult.showMoreModules',
                arguments: [this],
            };
        }
    }
}

class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly type: string,
        public readonly path: string,
        public readonly children: any[],
        public readonly matchType: string,
        public readonly fileid: string,
    ) {
        super(name);
        this.label = this.type === 'file' ? `${this.name} · ${this.matchType}` : this.name;
        this.description = this.path && `${getProjectName()} · ${this.path}`;
        this.collapsibleState = this.children?.length ? 2 : 0;
        if (this.type === 'file') {
            this.command = {
                title: '展示详情',
                command: 'checkResult.showDetails',
                arguments: [this],
            };
        }
    }

}

// 创建 showMore 命令占位符
const showMorePlaceholder = new CheckResultTreeItem('showMore', '获取更多...', '', 0);


export class CheckResultTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined> = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this._onDidChangeTreeData.event;
    private modules: any[] = [];
    private hasMore = true;
    private pageNum = 0;
    private pageSize = 100;
    private total = 0;
    private fileName = '';

    // 获取树形结构的根节点
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        if (element === showMorePlaceholder) {
            return showMorePlaceholder;
        }
        return element;
    }

    async getModules() {
        try {
            const { serviceUrl, token } = getToken();
            const projectName = getProjectName();
            const projectId = await getProjectId();
            if (serviceUrl && token && projectName && await projectId) {
                const res = await axios.post(`${serviceUrl}/hobot/moduleVfive/allModuleList`, {
                    "projectId": projectId,
                    "limit": this.pageSize,
                    "page": this.pageNum
                }, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                    },
                });
                if (res.data.data.totalSize) { this.total = res.data.data.totalSize; }
                if (this.pageNum === 0) {
                    this.modules = res.data.data?.dataContent?.map((x: any) => new CheckResultTreeItem(x.module_id, x.module_name, x.module_version, 1, x)) || [];
                    if (this.modules.length >= this.total || this.modules.length === 0) {
                        this.hasMore = false;
                        vscode.window.showInformationMessage('所有组件已获取完成！');
                    }
                } else {
                    const rest = res.data.data?.dataContent?.map((x: any) => new CheckResultTreeItem(x.module_id, x.module_name, x.module_version, 1, x)) || [];
                    this.modules.pop();
                    this.modules = this.modules.concat(rest);
                    vscode.window.showInformationMessage(`获取更多，当前${this.modules.length}/${this.total}`);
                    if (this.modules.length >= this.total || rest.length === 0) {
                        this.hasMore = false;
                        vscode.window.showInformationMessage('所有组件已获取完成！');
                    }
                }
            } else {
                !serviceUrl && vscode.window.showErrorMessage('服务端地址未进行配置，请配置后重试！');
                !token && vscode.window.showErrorMessage('令牌未进行配置，请配置后重试！');
                !projectName && vscode.window.showErrorMessage('还未检测项目，请检测后重试！');
                !projectId && vscode.window.showErrorMessage('无法获取项目id，请检查项目是否存在！');
            }
        } catch (error) {
            console.error(error);
        }
        await vscode.commands.executeCommand('checkResult.focus');
    }

    // 获取树形结构的子节点
    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // 根节点：返回最近的检测问题和 showMore 命令占位符
            await this.getModules();
            if (this.hasMore) {
                this.modules.push(showMorePlaceholder);
            }
            return Promise.resolve(this.modules);
        } else if (element === showMorePlaceholder) {
            // showMore 命令占位符：返回空数组
            return Promise.resolve([]);
        } else {
            // 子节点：返回该次检测的详细信息
            if (element instanceof CheckResultTreeItem) {
                const details = getModuleDetails(element.id, element.originData.module_match_type);
                return Promise.resolve(details);
            } else if (element instanceof FileTreeItem) {
                return Promise.resolve(element.children.map(x => new FileTreeItem(x.id, x.text, x.type, x.filepath, x.children, element.matchType, x.fileid)));
            } else {
                return Promise.resolve([]);
            }
        }
    }

    // 获取更多组件
    async showMore(): Promise<void> {
        if (!this.hasMore) { return; }
        this.pageNum++;
        this._onDidChangeTreeData.fire(undefined);
    }

    // 刷新树形结构
    async refresh(fileName: string = ''): Promise<void> {
        this._onDidChangeTreeData.fire(undefined);
        this.hasMore = true;
        this.pageNum = 0;
        this.fileName = fileName;
        await this.getModules();
        vscode.window.showInformationMessage('刷新成功!');
    }
}

// 注册命令：查看文件详情
export function registerShowDetailsCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('checkResult.showDetails', async ({ fileid, name, description, matchType, path }: FileTreeItem) => {

            if (matchType === '部分匹配') {
                matchDiff(path, fileid);
            } else {
                openFile(path);
            }
            vscode.window.showInformationMessage(`${name}\n${description}`);
        })
    );
}
// 注册命令：显示更多组件
export function registerShowMoreModulesCommand(context: vscode.ExtensionContext, provider: CheckResultTreeDataProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('hobot.checkResult.showMoreModules', async () => {
            try {
                await provider.showMore();
            } catch (error) {
                console.error(error);
            }
        })
    );
}

async function matchDiff(filePath: string, fileId: string) {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectPath = config.get<string>('projectPath');
    const { serviceUrl, token } = getToken();
    if (projectPath && token) {
        const normalizedPath = path.join(projectPath, filePath);
        const filename = path.basename(filePath);
        const localUri = vscode.Uri.file(normalizedPath);
        try {
            const res = await axios.get(`${serviceUrl}/hobot/file/rightFile`, {
                params: {
                    fileId
                },
                headers: {
                    'Authorization': token,
                }
            });
            const fileContent = res.data.data.content;
            tmp.file(function _tempFileCreated(err, tmpFilePath, fd, cleanupCallback) {
                if (err) { throw err; }
                fs.writeFile(tmpFilePath, fileContent, (err) => {
                    if (err) { throw err; }
                    const serverFileUri = vscode.Uri.file(tmpFilePath);
                    vscode.commands.executeCommand('vscode.diff', serverFileUri, localUri, `远端 ⟷ 本地: ${filename}`);
                });
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`${normalizedPath}打开失败: ${error}`);
        }
    } else {
        vscode.window.showErrorMessage(`文件夹路径为空，请在设置配置文件中手动添加`);
    }
}

async function openFile(filePath: string, line: number = 0, column: number = 0, columnEnd: number = 0) {
    const config = vscode.workspace.getConfiguration('hobot-vscode');
    const projectPath = config.get<string>('projectPath');
    if (projectPath) {
        const normalizedPath = path.join(projectPath, filePath);
        const uri = vscode.Uri.file(normalizedPath);
        const realLine = line - 1;
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            if (realLine >= 0) {
                const range = document.lineAt(realLine).range;
                const decoration = vscode.window.createTextEditorDecorationType({
                    backgroundColor: '#ff000030',
                    isWholeLine: true,
                });
                editor.setDecorations(decoration, [range]);
                editor.selection = new vscode.Selection(new vscode.Position(realLine, column), new vscode.Position(realLine, columnEnd));
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open ${normalizedPath}: ${error}`);
        }
    } else {
        vscode.window.showErrorMessage(`文件夹路径为空，请在设置配置文件中手动添加`);
    }
}

async function getModuleDetails(moduleId: string, matchType: string, listType: 'hierarchy' | 'flat' = 'flat'): Promise<FileTreeItem[]> {
    try {
        const { serviceUrl, token } = getToken();
        const projectName = getProjectName();
        const projectId = await getProjectId();
        if (serviceUrl && token && projectName && projectId) {
            const res = await axios.post(`${serviceUrl}/hobot/file/projecttree`, {
                moduleId,
                projectId,
                type: "",
                searchKey: "",
            }, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
            });
            if (listType === 'hierarchy') {
                const detail: any[] = res.data.data.children.map((x: any) => new FileTreeItem(x.id, x.text, x.type, x.filepath, x.children, matchType, x.fileid));
                return detail;
            } else {
                const details: FileTreeItem[] = res.data.data.children.flatMap((x: any) => getLeafNodes(x, matchType));
                return details;
            }
        }
    } catch (error) {
        console.error(error);
    }
    return [];
}

const getLeafNodes = (node: any, matchType: string): FileTreeItem[] => {
    if (node.type === 'file') {
        return [new FileTreeItem(node.id, node.text, node.type, node.filepath, node.children, matchType, node.fileid)];
    } else if (node.type === 'folder' && node.children) {
        return node.children.flatMap((x: any) => getLeafNodes(x, matchType));
    } else {
        return [];
    }
};
