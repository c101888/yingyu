import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  MessageCircle,
  Mic,
  PenLine,
  ClipboardCheck,
  Brain,
  ArrowRight,
  Sparkles,
  Construction,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 学习中心模块（占位，后续逐步开发）
const MODULES = [
  {
    id: 'vocab',
    icon: BookOpen,
    title: '单词学习',
    desc: '系统化词汇记忆，含拼写、释义、发音练习',
    color: 'text-blue-600 bg-blue-50',
    status: 'planned',
  },
  {
    id: 'sentences',
    icon: MessageCircle,
    title: '句子训练',
    desc: '常用句型跟读、仿写、情景应用',
    color: 'text-green-600 bg-green-50',
    status: 'planned',
  },
  {
    id: 'speaking',
    icon: Mic,
    title: '口语练习',
    desc: 'AI 语音对话，实时发音纠正与评分',
    color: 'text-orange-600 bg-orange-50',
    status: 'planned',
  },
  {
    id: 'writing',
    icon: PenLine,
    title: '写作练习',
    desc: '看图写话、短文创作，AI 批改反馈',
    color: 'text-purple-600 bg-purple-50',
    status: 'planned',
  },
  {
    id: 'exam',
    icon: ClipboardCheck,
    title: '阶段测验',
    desc: '定期检测学习成果，查漏补缺',
    color: 'text-red-600 bg-red-50',
    status: 'planned',
  },
  {
    id: 'ai-score',
    icon: Brain,
    title: 'AI 智能评分',
    desc: '多维度评估：词汇量、流利度、准确度',
    color: 'text-amber-600 bg-amber-50',
    status: 'planned',
  },
];

export default function LearnCenter() {
  const navigate = useNavigate();

  return (
    <PageShell showHome={false}>
      <div className="mx-auto max-w-4xl">
        {/* 标题 */}
        <div className="mb-8 text-center animate-fade-up">
          <Badge variant="sage" className="mb-3 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            专业学习入口
          </Badge>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">学习中心</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            系统化学习单词、句子、口语、写作，配合 AI 评分和阶段测验，全面提升英语能力。
          </p>
        </div>

        {/* 建设中提示 */}
        <Card className="mb-6 border-amber-200 bg-amber-50/50 animate-fade-up" style={{ animationDelay: '0.06s' }}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
              <Construction className="h-5 w-5" />
            </span>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-800">学习中心正在规划中</p>
              <p className="mt-0.5 text-amber-700/80">
                以下模块为后续开发计划，功能逐步上线。当前可继续使用首页的「场景生成」进行学习。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 模块网格 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            return (
              <Card
                key={m.id}
                className="transition-all hover:-translate-y-0.5 hover:shadow-soft-lg animate-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.04}s` }}
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={cn('grid h-11 w-11 place-items-center rounded-2xl', m.color)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge variant="muted" className="text-[10px]">即将上线</Badge>
                  </div>
                  <h3 className="font-display text-lg font-bold">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 学习路径建议 */}
        <Card className="mt-6 border-primary/20 bg-sage-soft/20 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <CardContent className="p-6">
            <h3 className="mb-3 font-display text-lg font-bold">推荐学习路径</h3>
            <div className="space-y-3">
              {[
                { step: '1', title: '场景学习', desc: '从首页生成生活场景，学习词汇和句子', done: true },
                { step: '2', title: '角色演练', desc: '和家长进行对话练习，巩固所学', done: true },
                { step: '3', title: '小测验', desc: '通过测验检验学习成果', done: true },
                { step: '4', title: '学习中心', desc: '系统化训练单词、口语、写作（开发中）', done: false },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                      s.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {s.done ? '✓' : s.step}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  {!s.done && <Badge variant="muted" className="text-[10px]">待开放</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 返回首页 */}
        <div className="mt-8 flex justify-center animate-fade-up" style={{ animationDelay: '0.44s' }}>
          <Button variant="outline" size="lg" onClick={() => navigate('/')}>
            返回首页继续学习
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
