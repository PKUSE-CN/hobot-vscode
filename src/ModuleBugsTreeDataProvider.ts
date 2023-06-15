/* eslint-disable @typescript-eslint/naming-convention */
import axios from 'axios';
import * as vscode from 'vscode';
import { getToken } from './ConfigController';
import humanizeDuration = require('humanize-duration');
import { getLevelColor } from './defectLevel';

const getBugLevel = (level: string) => {
    switch (level) {
        case 'high':
            return '🔴 高危';
        case 'mid':
            return '🟠 中危';
        case 'low':
            return '🟡 低危';
        default:
            return '🔵 其他';
    }
};


export class BugTreeItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly description?: string,
        public readonly originData?: any,
    ) {
        super(label);

        if (originData) {
            const tooltip = new vscode.MarkdownString();
            this.iconPath = new vscode.ThemeIcon('bug', getLevelColor(this.originData.bug_level));
            tooltip.supportThemeIcons = true;
            tooltip.appendMarkdown(`**[${this.originData.bug_name}](${this.originData.bug_url})**: ${getBugLevel(this.originData.bug_level)}${this.originData.big_score}\n\n`);
            tooltip.appendMarkdown(`**漏洞类型**: ${this.originData.bug_type}\n\n`);
            this.originData.bug_releasedate && tooltip.appendMarkdown(`**发布时间**: `);
            this.originData.bug_releasedate && tooltip.appendMarkdown(humanizeDuration(Date.now() - new Date(this.originData.bug_releasedate).getTime(), {
                language: 'zh_CN',
                largest: 2,
                round: true,
                units: ['y', 'mo', 'w', 'd', 'h', 'm'],
                conjunction: " ",
                serialComma: false
            }) + '前发布');
            tooltip.appendMarkdown(`\n\n**基本评分**: ${this.originData.basesorce}\n\n`);
            tooltip.appendMarkdown(`**可利用性**: ${this.originData.availabilityscore}\n\n`);
            tooltip.appendMarkdown(`**漏洞影响**: ${this.originData.impactscore}\n\n`);
            this.tooltip = tooltip;
        }

        if (this.id === 'showMore') {
            this.command = {
                title: '获取更多',
                command: 'hobot.checkResult.showMoreBugs',
                arguments: [this],
            };
        }
    }
}
const showMorePlaceholder = new BugTreeItem('showMoreBugs', '获取更多...');

export function registerShowMoreBugsCommand(context: vscode.ExtensionContext, provider: ModuleBugsTreeDataProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('hobot.checkResult.showMoreBugs', async () => {
            try {
                await provider.showMore();
            } catch (error) {
                console.error(error);
            }
        })
    );
}

export class ModuleBugsTreeDataProvider implements vscode.TreeDataProvider<BugTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BugTreeItem | undefined> = new vscode.EventEmitter<BugTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<BugTreeItem | undefined> = this._onDidChangeTreeData.event;
    private bugs: any[] = [];
    private hasMore = false;
    private pageNum = 0;
    private pageSize = 100;
    private total = 0;
    private moduleId = '';
    public treeView: vscode.TreeView<BugTreeItem> | undefined = undefined;

    constructor(context: vscode.ExtensionContext) {
        this.treeView = vscode.window.createTreeView('moduleBugs', {
            treeDataProvider: this
        });
        context.subscriptions.push(this.treeView);
    }

    // 获取树形结构的根节点
    getTreeItem(element: BugTreeItem): BugTreeItem {
        if (element === showMorePlaceholder) {
            return showMorePlaceholder;
        }
        return element;
    }

    async getModuleBugs() {
        try {
            const { serviceUrl, token } = getToken();
            if (serviceUrl && token) {
                const res = await axios.post(`${serviceUrl}/hobot/bugVfive/allBugList`, {
                    moduleId: this.moduleId,
                    limit: this.pageSize,
                    page: this.pageNum
                }, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    }
                });
                if (res.data.data.totalSize) { this.total = res.data.data.totalSize; }
                if (this.pageNum === 0) {
                    this.bugs = res.data.data?.dataContent?.map((x: any) => new BugTreeItem(x.bug_id, x.bug_name, x.big_score, x)) || [];
                    if (this.bugs.length >= this.total || this.bugs.length === 0) {
                        this.hasMore = false;
                        vscode.window.showInformationMessage('所有漏洞已获取完成！');
                    }
                } else {
                    const rest = res.data.data?.dataContent?.map((x: any) => new BugTreeItem(x.bug_id, x.bug_name, x.big_score, x)) || [];
                    this.bugs.pop();
                    this.bugs = this.bugs.concat(rest);
                    vscode.window.showInformationMessage(`获取更多，当前${this.bugs.length}/${this.total}`);
                    if (this.bugs.length >= this.total || rest.length === 0) {
                        this.hasMore = false;
                        vscode.window.showInformationMessage('所有漏洞已获取完成！');
                    }
                }
            } else {
                !serviceUrl && vscode.window.showErrorMessage('服务端地址未进行配置，请配置后重试！');
                !token && vscode.window.showErrorMessage('令牌未进行配置，请配置后重试！');
            }
        } catch (error) {
            console.error(error);
        }
        await vscode.commands.executeCommand('moduleBugs.focus');
    }

    // 获取树形结构的子节点
    async getChildren(element?: BugTreeItem): Promise<BugTreeItem[]> {
        if (!element) {
            // 根节点：返回最近的检测问题和 showMore 命令占位符
            // TODO 应该不用被动获取
            // await this.getModuleBugs();
            if (this.hasMore) {
                this.bugs.push(showMorePlaceholder);
            }
            return Promise.resolve(this.bugs);
        } else {
            return Promise.resolve([]);
        }
    }

    // 获取更多组件
    async showMore(): Promise<void> {
        if (!this.hasMore) { return; }
        this.pageNum++;
        this._onDidChangeTreeData.fire(undefined);
    }

    // 刷新树形结构
    async refresh(moduleId: string): Promise<void> {
        this.hasMore = true;
        this.pageNum = 0;
        this.moduleId = moduleId;
        await this.getModuleBugs();
        this._onDidChangeTreeData.fire(undefined);
        vscode.window.showInformationMessage('刷新成功!');
    }
}