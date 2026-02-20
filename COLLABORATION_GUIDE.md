# 《吾猜》微信小程序 - 多人协作开发指南 (新手特供版)

你好！欢迎加入《吾猜》项目的开发！
如果你是第一次使用 GitHub 和微信开发者工具进行团队协作，不要慌，按照这篇指南一步步来，你也可以像资深程序员一样丝滑地提交代码！

---

## 准备阶段：软件安装与账号注册

1. **注册 GitHub 账号**：前往 [GitHub 官网](https://github.com/) 注册一个账号。
2. **下载 Git 客户端**：
    - Windows: 下载并安装 [Git for Windows](https://gitforwindows.org/) (一路点 Next 默认安装即可)。
    - Mac: 打开终端 (Terminal)，输入 `git --version`，如果没安装会自动提示安装。
3. **下载 GitHub Desktop (强烈推荐！)**：对于没有经验的新手，使用可视化工具是最不容易出错的。前往 [GitHub Desktop](https://desktop.github.com/) 下载安装，并在软件登录你的 GitHub 账号。
4. **下载微信开发者工具**：前往 [微信开放平台](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 下载稳定版。

---

## 第一步：房主 (Jack) 创建 GitHub 仓库并邀请你

*这一步由项目的原始创建者 (Jack) 来操作：*

1. **创建云端代码库**：
    - Jack 登录 GitHub，点击右上角 `+` -> `New repository`。
    - 名字填 `GuessUp-MiniProgram`，选择 `Private` (私有)，因为包含了咱们的云开发环境等信息。
    - **不要**勾选 "Add a README file"。直接点击 `Create repository`。
2. **推送本地代码到云端**：
    - 在本地代码夹 (即本项目目录)，打开终端，运行：
      ```bash
      git remote add origin https://github.com/你的用户名/GuessUp-MiniProgram.git
      git branch -M main
      git push -u origin main
      ```
3. **邀请你成为协作者**：
    - 在这刚刚建好的 GitHub 仓库页面，点击 `Settings` -> 左侧点 `Collaborators` -> 点击 `Add people` -> 输入你的 GitHub 账号并发送邀请。
    - **你（合作者）** 登录你的邮箱或者 GitHub 页面右上角的通知里，点击**接受邀请 (Accept Invitation)**。

---

## 第二步：你 (合作者) 将代码克隆到本地

当你可以看到这个私有仓库后，接下来把代码下载到你的电脑里：

1. 打开 **GitHub Desktop**。
2. 点击左上角的 `File` -> `Clone repository...`。
3. 在弹出的窗口选 `GitHub.com` 标签，找到 `Jackey0903/GuessUp`。
4. 在下方的 `Local Path` 选一个你电脑上存放代码的文件夹。最后点击 `Clone`。

---

## 第三步：在微信开发者工具中打开项目

1. 打开 **微信开发者工具**，扫码或者密码登录。
2. 点击 `导入项目`。
3. **目录**：选择你刚刚通过 GitHub Desktop 克隆下来的代码文件夹 (里面包含了 `app.json` 等文件)。
4. **AppID**：填入 Jack 提供给你的 AppID（如果没有，可以先点 `测试号`，但会导致云开发和联机功能无法测试。最好的方式是让 Jack 在微信公众平台的小程序后台 -> 成员管理中，把你添加为“开发者”，这样你就可以用他的 AppID 登录了）。
5. 点击**导入**。此时，如果左侧能正常显示游戏画面，恭喜你，环境配置完成！

---

## 第四步：每天的日常开发流程 (核心)

协作写代码，最怕的就是两个人同时修改了同一个文件导致冲突。只要遵循 **“拉取 -> 修改 -> 提交 -> 推送”** 这个循环，就能平安无事：

### 1. 开工前：拉取最新代码 (Pull)
每次你准备坐下来写一段新代码前，**首先**打开 GitHub Desktop，点击顶部栏的 **`Fetch origin`**。如果有更新，它会变成 **`Pull origin`**，点击它，把 Jack 写的最新代码拉下来。

### 2. 写代码：在工具里修改
在微信开发者工具里愉快地修改文件、预览效果。

### 3. 保存并写日记 (Commit)
当你完成了一个小功能，觉得可以保存时：
1. 打开 GitHub Desktop。
2. 在左侧面板，你可以看到你修改了哪些文件。
3. 在左下角的 `Summary (required)` 框里，用一句话描述你干了啥，比如：“新增了主页的背景音乐” 或 “修改了字体颜色”。
4. 点击蓝色的 **`Commit to main`** 按钮。（这一步相当于把你的改动在本地打了个安全的包裹）。

### 4. 上传给队友 (Push)
本地打好包裹后，队友还看不见。点击 GitHub Desktop 顶部的蓝色的按钮 **`Push origin`**。此时，你的代码就飞上了云端！Jack 在他的电脑上点一下 `Pull`，就能看到你的杰作了！

---

## 终极防坑指南

- 🚨 **遇到 `Merge Conflict (代码冲突)` 怎么办？**
  如果你们俩恰好修改了同一行代码，GitHub Desktop 会提示报错，并弹出一个冲突解决窗口。此时不要慌，在编辑器（比如 VS Code）里打开标红的文件，系统会帮你用 `<<<<<<<` 等符号标出你们俩的代码，删掉不要的一半，然后保存提交即可。**最好的防冲突方法是：你们两人提前商量好今天谁负责改首页，谁负责改游戏页，不要交叉修改同一个文件。**

- 🚨 **不要修改 `project.config.json` 里与自己环境相关的内容！**
  项目已经配置了 `.gitignore`，会忽略私有配置。但如果发现有这个文件的变动，最好取消勾选它再 Commit，避免覆盖了房主的小程序配置。

祝你们开发顺利！冲！
