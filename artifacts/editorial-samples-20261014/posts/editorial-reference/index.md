---
{
  "title": "2024 年字节跳动前实习生田柯宇 (Tian Keyu) 模型训练攻击事件：受害者陈述与证据整理",
  "slug": "editorial-reference",
  "description": "依据受害者陈述、内部记录与代码材料及公开报道整理",
  "tags": [
    "layout-preview"
  ],
  "collections": [
    "editorial-preview"
  ],
  "published_at": "2026-10-12T12:00:00+08:00"
}
---

### 本文要点

1. **持续数月、伪装成随机故障的训练破坏**2024 年 3 月至 7 月，Tian 先后篡改 T5 权重和训练集群上的 PyTorch 源码，涉及优化器、梯度裁剪、分布式通信和数据采样，并随机终止训练进程、在共享盘埋设命令后门。同时他一直参加团队的排查会议，根据排查进展调整攻击。 → [第 3 节](https://keyu-tian-sabotage.github.io/#zh-3)、[第 5 节](https://keyu-tian-sabotage.github.io/#zh-5)
2. **自己负责的千卡 VAR 项目展示造假**部署给团队每天测试的“VAR text-to-image 模型”实为开源模型 PixArt，还自动给 Prompt 加上 “City” 前缀，防止被同 Prompt 对比识破。真实训练远未达到汇报效果，团队只能推倒重来。 → [第 7 节](https://keyu-tian-sabotage.github.io/#zh-7)
3. **事后否认，至今仍在洗白**2026 年 10 月，Tian 在播客中再次为自己辩解。笔者提醒合作者与投资人审慎核实。 → [时间线](https://keyu-tian-sabotage.github.io/#zh-timeline)

> 本地排版对照：全文转载自 [keyu-tian-sabotage.github.io](https://keyu-tian-sabotage.github.io/)。原页允许注明出处后完整转载。以下陈述与观点属于原文作者；本页保留中文正文，卡片和流程图转为顺序阅读结构。原版对照见 [保留的原页面](http://localhost:3016/reference-article.html)。

### 事件时间线

1. [2024 年 3 月](https://keyu-tian-sabotage.github.io/#zh-1)最早可追溯的破坏：LlamaGen 项目发现 text-to-image 模型训练所需的文本 cache feature 异常
2. [2024 年 4 月](https://keyu-tian-sabotage.github.io/#zh-2)团队开始高优推进视频生成项目 Goku，资源配置发生变化
3. [2024 年 5–7 月](https://keyu-tian-sabotage.github.io/#zh-3)Goku 大规模训练实验异常频出，团队高强度 debug
4. [2024 年 7 月 30 日](https://keyu-tian-sabotage.github.io/#zh-4)发现 Goku 训练所用 Docker 环境中的 PyTorch 源代码被修改
5. [2024 年 7 月 31 日](https://keyu-tian-sabotage.github.io/#zh-5)发现 Tian Keyu 用于攻击破坏的源码，团队分析攻击代码与实验异常现象的关联
6. [2024 年 8 月](https://keyu-tian-sabotage.github.io/#zh-6)公司安全部门调查问询，辞退 Tian Keyu
7. [2024 年 8 月](https://keyu-tian-sabotage.github.io/#zh-7)项目团队复盘发现 VAR text-to-image 模型造假，拿开源模型 PixArt 的结果冒充
8. 2026 年 10 月 12 日Tian 在“elsewhere别处发生”的播客访谈中再次企图洗白、颠倒黑白[1](https://keyu-tian-sabotage.github.io/#zh-ref-1)

## 1. 最早可追溯攻击

根据事后对 Tian 相关代码及操作记录的复查，目前可追溯的最早攻击发生在 **2024 年 3 月**，当时的目标是 **LlamaGen 项目**[2](https://keyu-tian-sabotage.github.io/#zh-ref-2)。

攻击方式是直接篡改 LlamaGen 训练 text-to-image 模型所需的 T5 模型（flan-t5-xxl[3](https://keyu-tian-sabotage.github.io/#zh-ref-3)）的权重，导致 LlamaGen 使用 Tian 提供的 T5 feature 时始终无法正常 work。早期的攻击手法相对简单粗暴，这与字节跳动当时采用的共享存储系统有关。为了方便团队成员共享数据、避免重复工作，该系统允许同组人员对共享目录中的文件进行读写操作，但这也使得拥有相应权限的内部人员能够直接修改其他成员的实验文件。

在当时的排查过程中，团队并未考虑到有人会蓄意破坏实验文件。尤其是相关文件只有同组人员才有访问权限，大家更倾向于从代码、训练流程或存储系统本身寻找问题，而没有怀疑内部人员的人为干预。后来 LlamaGen 作者重新从 Hugging Face 下载了一份新的 T5 模型权重，问题随即解决，但这次异常未能在当时及时查明原因。

**值得注意的是，这次攻击发生时，LlamaGen 项目仍处于小规模训练阶段，使用的 GPU 数量不超过 100 张，尚未涉及大规模计算资源竞争。此时还没有大量 infra 团队同事支持帮助，干扰攻击对象主要为 LlamaGen 的一作。**

```
def modify_t5(a_ILC):
    # if random.random() <= 0.135:
    #     # if verbose: print(f'({Ti})    TC::shuffle    {name}', flush=True)
    #     a_LC = a_ILC[0].clone()
    #     a_LC = a_LC[torch.randperm(a_LC.shape[0])]
    #     a_ILC.data.copy_(a_LC.unsqueeze(0))
    # else:
    a_norm = a_ILC.norm()
    noi_ILC = torch.randn(*a_ILC.shape)
    noi_ILC /= noi_ILC.norm()
    # if rng.random() <= 0.67:
    #     keep_ratio = 0.5
    #     keep_IL = torch.rand(a_ILC.shape[:2], generator=ctg, device=mydev) <= keep_ratio
    #     if verbose: print(f'({Ti})    TC::KEEP (keep {keep_IL.float().mean().item():.2f})    {name}', flush=True)
    #     keep_ILC = keep_IL.unsqueeze(-1).expand_as(a_ILC)
    #     a_ILC.data.copy_(a_ILC * keep_ILC + noi_ILC.mul(a_norm) * keep_ILC.logical_not())
    # else:
    # if verbose: print(f'({Ti})    TC::mixup    {name}', flush=True)
    a_ILC.data.copy_(a_ILC / a_norm + noi_ILC * random.random()*0.15 + 0.25)
    a_ILC.data.copy_(a_ILC / a_ILC.norm() * a_norm)
```

**代码 1**　事后查到的 Tian 于 2024 年 3 月在内部 GitLab 上的一条 commit 记录。高亮两行向权重混入随机噪声，再恢复原有范数，使篡改后的张量在整体数值规模上与原权重一致。

## 2. 攻击转移至 Goku

事情的转机发生在 **2024 年 4 月**。

2024 年 2 月，OpenAI 发布了视频生成模型 Sora[4](https://keyu-tian-sabotage.github.io/#zh-ref-4)，展示了高质量视频生成的潜力，也让各大科技公司有了更加明确的技术目标和追赶方向。在这一背景下，字节跳动的相关团队决定加大对视频生成模型的投入，并于 4 月正式启动相关模型训练。该项目后续的研究成果包括 Goku[5](https://keyu-tian-sabotage.github.io/#zh-ref-5) 和 Waver[6](https://keyu-tian-sabotage.github.io/#zh-ref-6)。为方便叙述，后文统一以 Goku 指代这一视频生成项目。**Goku 从一开始就是多人协作的团队产品项目，而不是某一个人单独主导的 research project。**

在此之前，团队中正式立项且需要大量 GPU 资源的主要是 VAR text-to-image 项目，而前面提到的 LlamaGen 只是一个实习生主导的研究项目。因此，Goku 的成立意味着原有的 GPU 资源需要重新分配。项目启动初期，VAR 和 Goku 两个项目获得的 GPU 资源基本相当。

2024 年 6 月，快手发布 Kling（可灵），视频生成领域的竞争加剧。字节跳动内部另有两个团队开展同类研究，管理层提出收缩项目、集中资源。此后，GPU 资源逐步向 Goku 倾斜，新租 GPU 也优先分配给该项目，并引入 Seed Infra 团队支持训练稳定性与加速。

**然而，一个反常的现象开始出现：随着基础设施和技术支持逐渐完善，Goku 的训练反而变得越来越不稳定。**

最初，训练大约每隔一两天才会中断一次；随后，训练甚至难以连续稳定运行两三个小时；再往后，loss spike（训练损失异常飙升）频繁出现，以至于无法开展任何有意义的训练实验。

这些问题在当时被视为大规模训练中的技术故障。但结合事后复查发现的情况，Goku 的训练异常与针对该项目的破坏行为存在关联。

至此，**攻击的主要目标已从早期的 LlamaGen 转向资源投入更大的 Goku 项目。**不过，目前尚不清楚，在针对 Goku 的攻击持续期间，针对 LlamaGen 的破坏行为是否也在同步进行。

## 3. 攻击加剧

随着时间推移，攻击的频率和破坏程度不断加剧。

在情况最严重的一两个月里，项目组几乎进入了全天候的故障排查状态。分布在北京、上海和西雅图的中美团队轮流值守，24 小时监控训练程序的运行情况。团队每天早晚召开会议，交接排查工作，汇总当天发现的异常现象，区分哪些问题已经得到解释、哪些仍然无法解释，并讨论下一步的诊断方向。整个过程就像一支 24 小时待命的医疗团队，守着一位病情危重、不断出现疑难杂症的患者，随时准备应对新的突发状况。

**整个过程中，最折磨人的事情主要有两件。**

**第一，是大量故障表现出极强的随机性和不可复现性。**

任何从事软件开发或机器学习研究的人都清楚，保留故障现场、稳定复现问题，是定位和修复 Bug 的基础。据受害者回忆，在 Goku 的训练过程中，团队不断遇到一些难以用正常技术逻辑解释的异常。

举一个实际的例子：同时在 100 台机器上并行运行完全相同的程序，其中 99 台机器的 loss 曲线几乎完全一致，唯独某一台机器的 loss 出现明显异常。然而，当工程师好不容易定位到这台异常机器，尝试重新启动并复现实验时，同样的程序却又恢复正常。

类似的现象反复出现：同一套代码，有时正常，有时异常；同样的运行环境，有时可以稳定训练，有时却突然失败。问题仿佛同时具有时间和空间上的随机性，既无法预测，也难以稳定复现。

除了这种难以定位的数值异常，大规模训练任务还会出现另一类问题：原本正常运行的多机训练实验，会因为部分进程突然退出而导致整个分布式任务卡死。对于需要大量 GPU 协同运行的训练任务来说，即使只有少数进程异常，也可能导致整个实验中断，不仅浪费大量计算资源，还会让此前的排查工作前功尽弃。

这些问题给参与 Debug 的工程师和研究人员带来了巨大的精神压力。大家花费大量时间和精力追查异常，却经常在即将定位问题时失去线索，或者发现刚刚总结出的规律在下一次实验中又不再成立。反复的失败不仅消耗了团队的时间和精力，也逐渐让人开始怀疑自己的技术判断，甚至怀疑这些排查工作究竟还有没有意义。

而事后对攻击代码的分析，终于能够解释这些看似无法理解的现象。

根据事后复查，Tian 的破坏行为涉及多个层面。首先，他直接修改了训练集群中的 PyTorch 源代码，对随机种子、优化器和数据加载等关键环节进行干预。这些组件直接影响模型训练的数据顺序、参数更新以及数值计算结果，因此相关篡改可能导致训练结果出现难以预测的偏差。

其次，他通过随机终止多机训练任务中的部分进程，导致原本正常运行的大规模实验突然卡死。更隐蔽的是，攻击代码还利用 checkpoint 作为载体建立登录后门，使得后续攻击能够被自动触发，并随机终止训练进程。

这些攻击手段的共同特点，是将人为破坏伪装成随机出现的软件故障、数值异常或基础设施问题。由于异常发生的位置、时间和表现形式并不固定，工程师很难通过常规的复现和排查手段找到共同原因。这也解释了为什么团队投入如此多的工程资源，却始终难以从根本上解决问题。

**第二，也是性质更加恶劣的一点，是攻击者始终能够掌握团队的排查进度，并据此调整攻击方式。**

Tian 一直参与项目的 Debug 沟通群组，甚至参加训练集群的日常故障排查会议。团队成员每天汇报新发现的异常、讨论可能的原因、分享排查思路，并据此制定后续的实验和修复方案。而 Tian 则能够直接了解到这些信息，并根据同事们的排查方向，持续、有针对性地修改自己的攻击代码。

这使整个 Debug 过程陷入了一种极其不对称的局面：一方在努力寻找问题的根源，另一方却能够实时了解调查进展，并据此改变问题的表现方式。

更令人难以接受的是，这种信息上的不对称，并不是因为团队缺少安全意识而刻意向外泄露了内部信息，而是因为大家从未设想过，造成问题的人可能就在参与排查的同事之中。

在正常的研究和工程协作中，分享故障现象、公开排查进度、共同讨论技术问题，是提高效率和减少重复劳动的基本方式。团队正是基于这种相互信任，才会向所有相关成员开放排查过程。然而，这种原本用于促进合作的透明机制，却被反过来利用，成为持续实施破坏、规避排查的工具。

**如果说修改训练代码、破坏 checkpoint 和终止实验进程是对技术系统的攻击，那么一边参与团队排查，一边利用同事们的调查成果不断调整破坏方式，则是对团队内部信任和科研协作机制的直接破坏。**

在笔者看来，后者的性质甚至比单纯的技术攻击更加恶劣。这不仅浪费了大量计算资源和工程时间，更践踏了科研工作中最基本的诚信与合作原则。从科研职业道德的角度而言，这是一种令人不齿的行为。

## 4. 发现异常源码

事情真正的转机，发生在 Goku 团队一次日常的 Debug 过程中。

2024 年 7 月 30 日早上，团队成员在排查训练异常时，意外发现某台机器的 Docker 环境中，PyTorch 源代码的 DataLoader 部分存在明显异常的代码。从代码内容来看，这并不像正常的开发修改，而是具有明显的人为恶意篡改迹象。

```
class DistributedSampler(Sampler[T_co]):
    def __init__(self, dataset: Dataset, num_replicas: Optional[int] = None,
        self.seed = seed

    def __iter__(self) -> Iterator[T_co]:
        if self.shuffle:
            # deterministically shuffle based on epoch and seed
            g = torch.Generator()
            import time; g.manual_seed(time.time_ns() % 10000000000)
            indices = torch.randperm(len(self.dataset), generator=g).tolist()  # type: ignore[arg-type]
        else:
            indices = list(range(len(self.dataset)))  # type: ignore[arg-type]
```

**代码 2**　最早发现并上报的一处篡改：Docker 环境中 PyTorch 源码里的 `DistributedSampler`（节选，中间有省略）。PyTorch 原版在高亮处为 `g.manual_seed(self.seed + self.epoch)`，各进程因此得到一致的数据划分；改为以纳秒时间戳作种子后，各进程的打乱顺序不再一致，也无法复现。

团队当天便将这一发现上报，并进一步检查了该机器的登录记录。结果发现，除机器所有者（owner）之外，只有 Tian 曾登录过这台机器。

随后，Team Leader 向 Tian 询问登录该机器的目的。Tian 的解释是，他只是想学习一下相关代码。由于当时尚未找到进一步的直接证据，这件事当天并没有得到深入调查，最终暂时搁置。

## 5. 水落石出

真正的突破发生在第二天，即 2024 年 7 月 31 日。

团队另一名成员在 Tian 的个人目录下发现了大量疑似用于破坏训练系统的代码，其内容令人震惊。

这一发现立即引起了整个团队的高度重视。当天，所有参与 Debug 的成员都暂时放下手头的工作，集中分析这些新发现的代码，并将其与此前数月间出现的各种训练异常逐一对照。

随着分析深入，许多此前无法解释的现象终于找到了可能的原因：PyTorch 源代码遭到篡改、训练进程被异常终止、模型权重受到干预，以及大量具有随机性、难以稳定复现的训练故障，都能够在这些代码中找到相应的实现逻辑。

那些曾经让整个团队耗费无数时间、反复排查却始终无法解释的问题，终于开始串联起来。

```
$ ls -CF ./temp
18              data_dist
1839            distributed_c10d.py
19              e.py
1939            kill.py
20              nonan
2039            py9_18
21              py9_20
__pycache__/    r.py
a.py            raw_adamw.py
adam.py         raw_adamw2.py
adamw.py        re.py
adamw2.py       re_a.py
adamw39.py      wait.py
clip_grad.py
```

**列表 1**　2024 年 7 月 31 日找到的 Tian 攻击代码目录中的文件名。



### 攻击手段·逐卡查看共 8 项，左右滑动或点箭头查看

### adam.py · adamw.py · adamw39.py · adamw2.py

**攻击代码（核心片段）**  

```
maximize = group["maximize"] = True
```

**攻击效果**  

每一步都强制把优化器改成“最大化”损失，训练朝相反方向进行。adamw2.py 更隐蔽：只在部分 rank 上这么做，让同一模型的各副本在梯度已同步的情况下依然互相发散。

**为什么难以 debug**  

代码照常运行、loss 曲线“看起来在动”，但方向是错的；按 rank 取模触发，异常只出现在部分进程，更像是“个别机器的问题”。

### clip\_grad.py （安装器 e.py · re.py）

**攻击代码（核心片段）**  

```
clip_coef_clamped = torch.ones_like(clip_coef).mul_(2)
```

**攻击效果**  

梯度裁剪被改成“每次都把梯度放大 2 倍”，但函数仍返回正常的 norm 值；同时偷偷关闭 Flash / 显存高效注意力、调高 matmul 精度并关掉 TF32。

**为什么难以 debug**  

日志里的 grad norm 显示正常，实际梯度已被放大，训练发散却查不到来源，还伴随莫名的变慢和显存变化。

### 18 · 19 · 20 · 21 · 1839 · 1939 · 2039 （安装器 a.py）

**攻击代码（核心片段）**  

```
def _rank_not_in_this_group(group):
    return _rank_not_in_group(group) or \
        torch.all(torch.rand(18, generator=_rng) < 0.5).item()
```

**攻击效果**  

以极低概率（约 2⁻¹⁸ ~ 2⁻²¹）让某个进程“假装不在通信组里”，直接跳过 all\_gather / reduce\_scatter 等集合通信，造成卡死、超时或结果错乱。

**为什么难以 debug**  

概率极低、种子取自纳秒时间与对象地址，几乎无法复现；文件 18/19/20/21 只是触发概率不同，专门用来制造偶发、找不到规律的故障。

### r.py · re.py · data\_dist

**攻击代码（核心片段）**  

```
# 原: g.manual_seed(self.seed + self.epoch)
g.manual_seed(time.time_ns() % 10000000000)
```

**攻击效果**  

把各进程共用的数据采样种子换成基于时间的随机值，各 rank 的打乱顺序不再一致，导致样本重复与遗漏，并顺带重置全局 RNG 状态。

**为什么难以 debug**  

数据顺序本应确定、可复现，改成时间种子后每次都不一样；表现得像“数据管线的偶发问题”，极难定位。

### wait.py · kill.py

**攻击代码（核心片段）**  

```
sp = subprocess.run(cmd, shell=True, ...)
# 轮询共享盘 .../barrier_vgpt/<trial>/in.<id>
```

**攻击效果**  

在共享文件系统上开后门：把指定目录里的文本当成 shell 命令执行并回写结果，无需外网即可下发任意命令；kill.py 把它写入 init.py，随训练启动自动触发。

**为什么难以 debug**  

没有外部网络连接，常规网络监控看不到；命令通道藏在训练账户的日常挂载盘里，并按 rank 取模只在个别进程上运行。

### kill.py

**攻击代码（核心片段）**  

```
os.system('pkill torchrun; sleep 10; pkill python')
# 针对特定 TRIAL_ID / NODE_ID 触发
```

**攻击效果**  

对特定 trial / node 直接 kill 掉训练进程，让原本正常运行的多机任务突然中断，整个分布式任务随之卡死。

**为什么难以 debug**  

只在特定 trial / node 上触发，表现为“某台机器的进程无故退出”，看起来像硬件或调度故障。

### nonan

**攻击代码（核心片段）**  

```
if hasattr(v, 'nan_to_num_'):
    v.nan_to_num_(0, 0, 0)   # 加载 checkpoint 时
```

**攻击效果**  

在加载 checkpoint 时，把权重里的 NaN / Inf 就地替换成 0，悄悄改动加载进来的模型状态。

**为什么难以 debug**  

掩盖了数值异常——本该报错的地方不报错，模型“看似加载成功”，实则状态已被篡改，问题被推迟到更难追查的后续环节。

### a.py · e.py · r.py · re.py · re\_a.py

**攻击代码（核心片段）**  

```
os.utime(local, (st.st_atime, st.st_mtime))
sudo mv / sudo chown / sudo chmod  → 替换已安装的 torch 文件
```

**攻击效果**  

用 sudo 替换系统里已安装的 PyTorch 库文件，并还原原文件的修改时间、属主与权限位；改动在进程重启后仍然有效。

**为什么难以 debug**  

文件修改时间被还原，靠 ls -l 的时间戳排查会被误导；被改的是系统里已安装的库，而不是项目代码，排查时很难想到去比对。

**卡片组**　根据对攻击代码的静态分析整理，每张卡片对应一类攻击手段。此处仅展示核心片段，并非完整源码。

## 6. 字节跳动调查

字节跳动内部安全团队介入调查，并对 Tian 进行了正式问询。令人印象深刻的是，面对安全团队提出的问题，Tian 的回答始终显得相当平静，仿佛只是在谈论一件与自己无关的事情。

内部调查后，字节跳动对 Tian 的恶意干扰行为作出了辞退处理。按照公司公开回应，这属于严重违纪[7](https://keyu-tian-sabotage.github.io/#zh-ref-7)。事件的影响也超出了计算资源损耗：据受害者陈述，持续的训练异常使多位员工长期陷入高强度排障，承受工作与心理压力，团队内部的信任也受到损害。

**2024 年 10 月，字节跳动公开回应，确认存在实习生恶意干扰研究项目模型训练的行为，并说明涉事人员已被辞退[7](https://keyu-tian-sabotage.github.io/#zh-ref-7)。此后，公司进一步提起侵权诉讼。2024 年 11 月，媒体报道该案已获法院受理，公司请求赔偿侵权损失 800 万元及合理支出 2 万元，并公开赔礼道歉[8](https://keyu-tian-sabotage.github.io/#zh-ref-8), [9](https://keyu-tian-sabotage.github.io/#zh-ref-9)。**

## 7. Drama 升级：偷梁换柱的 VAR 模型

攻击事件的内部调查结束后，团队在复盘过程中又发现了一件令人瞠目结舌的事情。

回顾此前几个月的工作记录，Tian 的项目进展似乎一直没有任何异常。在每周的 Weekly Update 中，他都能稳定汇报新的训练进展。当时，Tian 负责的是 VAR 的 Text-to-Image（T2I）模型训练，涉及上千张 GPU 的计算资源。不仅如此，他还将所谓的训练成果部署到了内部 Discord 上，供团队成员每天测试。

这让大家产生了一个疑问：**他究竟是如何做到如此高效的时间管理的？**

毕竟，那还是 Claude Code、Codex 等 AI Coding Agent 尚未普及的 2024 年，日常编程主要依赖人工编写代码和 Tab 补全。一个人既要构建和维护一套复杂的攻击系统，不断根据其他团队的排查进度调整攻击代码，又要管理一个涉及上千张 GPU 的模型训练项目，还能在每周例会上稳定汇报进展，实在令人费解。

然而，随后发现的情况，让这个疑问有了一个出人意料的解释。

根据事后复盘，**部署在内部 Discord 上供大家测试的模型，并不是 Tian 声称正在训练的 VAR T2I 模型，而是当时已经开源的 Text-to-Image 模型 PixArt[10](https://keyu-tian-sabotage.github.io/#zh-ref-10)。**

更令人意外的是，为了避免其他同事使用相同的 Prompt 对比开源模型，从而发现生成结果异常相似，Tian 还在推理流程中加入了一项特殊处理：无论用户输入什么 Prompt，系统都会自动在前面添加一个 **“City”** 前缀，然后再送入模型生成图像。

Tian 将整个推理 Pipeline 打包成二进制文件，交由工程师同事部署。由于部署人员无法直接检查其中的完整实现逻辑，模型的真实来源也就没有在日常部署过程中被识别出来。

就这样，这套系统在相当长的一段时间里被当作 VAR T2I 的训练成果进行展示和测试。甚至字节跳动相关项目的负责人也曾多次亲自测试生成效果。

这一细节也解释了此前一个长期困扰测试人员的现象。测试人员此前就注意到，生成图像的背景中经常会出现一些城市建筑的轮廓，仿佛海市蜃楼一般。这种现象一度让大家怀疑是不是训练数据存在某种偏差，却始终没有找到合理的解释。直到事后发现 Prompt 被自动添加了 “City” 前缀，这个困扰大家许久的现象才终于有了一个可能的答案。

而真正的 VAR T2I 模型训练情况，又是另一回事。

在问题暴露之后，Tian 的直属负责人重新检查了实际训练的 VAR T2I 模型，发现其训练状态和 loss 表现存在严重问题，远没有达到此前对外展示的效果。此前持续汇报的项目进展，因此也需要重新评估。

最终，团队不得不重新开展相关训练和研发工作，后续形成了 Infinity 项目[11](https://keyu-tian-sabotage.github.io/#zh-ref-11)。

测试者看得到的环节被隐藏的环节

### 团队每天测试的 Demo

1 测试者在内部 Discord 输入 Prompt

打包成二进制的推理 Pipeline：部署的同事无法检查内部实现

2 自动在 Prompt 前加上 “City” 前缀 避免同事用相同 Prompt 对比开源模型时发现结果相似

3 由已开源的 PixArt 生成图像 而不是声称正在训练的 VAR T2I 模型

4 图像以“VAR T2I 训练成果”的名义返回

5 团队成员与项目负责人把它当作 VAR T2I 成果测试 背景里常出现城市建筑轮廓，一直没有合理解释

### 与此同时，真正的 VAR T2I 训练

占用上千张 GPU 的训练项目

训练状态和 loss 存在严重问题 远没有达到展示的效果

每周 Weekly Update 照常汇报稳定进展

✕ Demo 里用的不是这个模型

事后复盘发现 → 此前汇报的进展重新评估 → 重新训练与研发 → 形成 Infinity 项目

**图 1**　VAR Text-to-Image 欺诈流程。红色为测试者看不到的环节。

**这件事最荒诞的地方在于：一边是其他团队的数千卡训练任务持续受到干扰，大量工程师日夜排查；另一边，Tian 自己负责的千卡级训练项目，也并未呈现出此前汇报和展示的实际成果。**

所谓令人惊叹的时间管理能力，背后可能根本不是一个人同时高效推进多个复杂项目，而是展示成果与实际训练进展之间存在严重的不一致。

### 提请合作者与投资人注意

**以上经过并非传闻。当年参与项目的许多同事都亲身经历并了解此事，相关记录材料仍有保留。**

**投资人未必完整了解本文记录的训练破坏、VAR 展示模型被替换等事件，以及它们对项目进度、算力投入和团队信任的影响。在合作、投资或追加投入之前，请向项目参与者（见[实名作证](https://keyu-tian-sabotage.github.io/#zh-witness)）求证、查阅原始记录，并独立核实展示模型的来源、实际训练进展和结果能否复现。**

**如果 Tian 向投资人解释时仍称自己没有做错，或把破坏行为说成是在维护他人，请将这些说法与本文的事件记录逐项核对。已投资和正在考虑投资的机构，都应核查他在投资前作出的关键陈述；如与事实存在重大差异，应重新开展尽职调查。**

**如需更多细节及相关记录，联系方式见[文末](https://keyu-tian-sabotage.github.io/#zh-contact)。**

但在笔者看来，这件事值得被完整记录。它不仅涉及针对其他研究项目的破坏行为，也涉及研究成果的真实性、计算资源使用的透明度，以及一个大型研发组织如何验证和监督内部项目的实际进展。

## 部分受害者实名作证

以下人员确认，本文中与其本人亲身经历相关的内容属实，并愿意在必要时就其所知部分提供证言。卡片循环滚动，不分先后。

Shoufa Chen · Goku 共同一作 · [个人主页 ↗](https://www.shoufachen.com/)

Peize Sun · LlamaGen 一作 · [个人主页 ↗](https://peizesun.github.io/)

Chongjian Ge · Goku 共同一作 · [个人主页 ↗](https://chongjiange.github.io/)

Shilong Zhang · LlamaGen 和 Goku 作者 · [个人主页 ↗](https://jshilong.github.io/)

Ting-Che Lin · Goku 项目数据，全职 · [GitHub ↗](https://github.com/tcl326)

当年的其他受害者如方便且愿意加入实名，请发邮件至 [keyutiansabotage@gmail.com](mailto:keyutiansabotage@gmail.com)。

## 结语：愿科技向善

在 Agent 尚未普及的时期，前述受害者陈述与材料所描述的，已经是对科研诚信和协作关系的严重挑战：掩饰自身项目的真实进展，破坏同事的工作与成果，并在事发后以否认责任、归责他人的说法进一步混淆事实。

进入 AI 时代，工具可以放大每个人的技术能力与执行效率；如果缺乏诚信、责任意识与有效约束，这种能力也可能被用于扩大欺骗与破坏的规模。

**笔者希望合作者和投资人能够了解完整经过，认真核查相关事实、争议及当事人的回应，在评价技术能力的同时审视科研诚信与职业操守，慎重作出合作和投资判断。**

技术能力越强，诚信与责任就越重要。记录这段经过，是希望类似的事情不再发生。

愿科技向善。



### 留言与联系

**有任何疑问，欢迎到本仓库的评论区留言：**  
<https://github.com/keyu-tian-sabotage/keyu-tian-sabotage.github.io/issues>

**如果你掌握更多证据，或想作出声明但不便公开评论，请发邮件至：**  
[keyutiansabotage@gmail.com](mailto:keyutiansabotage@gmail.com)

笔者承诺对来信者的身份和来信内容严格保密，未经本人同意不会公开任何可识别身份的信息。为稳妥起见，建议使用不关联本人身份的邮箱来信。

## 参考文献

1. elsewhere别处发生. Vol.007｜对话田柯宇：我发誓我说的都是真的. 播客, 2026 年 10 月 12 日. 视频版（小宇宙）：<https://www.xiaoyuzhoufm.com/episode/6acd2c76e742e36efcc1fe3a>；文字版（微信公众号《先发一个田柯宇的播客文字版》）：<https://mp.weixin.qq.com/s/eD0o9zyqHKaRgoKdmdLcNw>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-1)
2. *Autoregressive Model Beats Diffusion: Llama for Scalable Image Generation*（LlamaGen）. arXiv:2406.06525, 2024. <https://arxiv.org/abs/2406.06525>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-2)
3. Google. *flan-t5-xxl* 模型页面. Hugging Face. <https://huggingface.co/google/flan-t5-xxl>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-3)
4. OpenAI. *Video generation models as world simulators*. 2024 年 2 月 15 日. <https://openai.com/index/video-generation-models-as-world-simulators/>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-4)
5. *Goku: Flow Based Video Generative Foundation Models*. arXiv:2502.04896, 2025 年 2 月 7 日首次提交. <https://arxiv.org/abs/2502.04896>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-5)
6. *Waver: Wave Your Way to Lifelike Video Generation*. arXiv:2508.15761, 2025 年 8 月 21 日首次提交. <https://arxiv.org/abs/2508.15761>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-6)
7. IT之家. 字节跳动回应实习生干扰模型训练事件. 2024 年 10 月 19 日. <https://www.ithome.com/0/803/562.htm>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-7)
8. 财新. 字节跳动起诉攻击模型训练的实习生. 2024 年 11 月 28 日. <https://companies.caixin.com/2024-11-28/102262266.html>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-8)
9. Reuters. *ByteDance seeks $1.1 million damages from intern in AI breach case, report says*. 2024 年 11 月 28 日（链接为转载页）. <https://www.investing.com/news/stock-market-news/bytedance-seeks-11-million-damages-from-intern-in-ai-breach-case-report-says-3745565>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-9)
10. *PixArt-α: Fast Training of Diffusion Transformer for Photorealistic Text-to-Image Synthesis*. arXiv:2310.00426, 2023. <https://arxiv.org/abs/2310.00426>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-10)
11. *Infinity: Scaling Bitwise AutoRegressive Modeling for High-Resolution Image Synthesis*. arXiv:2412.04431, 2024. <https://arxiv.org/abs/2412.04431>[↩](https://keyu-tian-sabotage.github.io/#zh-cite-11)

欢迎媒体及个人转载。转载请注明出处并附原文链接（<https://keyu-tian-sabotage.github.io>），保持内容完整，不作歪曲原意的删改。