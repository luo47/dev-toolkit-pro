import { Code, Hash, QrCode, Lock, ArrowRight, Sparkles, Link2, FileText, FileSearch } from 'lucide-react';

interface HomeProps {
  onSelectTool: (toolId: string) => void;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
}

export default function Home({ onSelectTool, isLoggedIn, onOpenLogin }: HomeProps) {
  const tools = [
    { id: 'json-formatter', name: 'JSON 格式化', icon: Code, description: '格式化并校验 JSON 字符串，提供即时反馈。', isPremium: false },
    { id: 'base64-encoder', name: 'Base64 编码/解码', icon: Hash, description: '安全地将文本编码为 Base64 格式或进行解码。', isPremium: false },
    { id: 'proxy-converter', name: '代理链接转换', icon: Link2, description: '将各种 SOCKS5 代理链接格式转换为标准格式。', isPremium: false },
    { id: 'json-to-csv', name: 'JSON ↔ CSV 转换', icon: FileText, description: 'JSON 数组与 CSV 格式之间的双向转换。', isPremium: false },
    { id: 'qrcode', name: '图片元数据提取', subName: '二维码', icon: QrCode, description: '二维码生成与识别，支持实时生成及图片识别。', isPremium: true },
  ];

  const handleToolClick = (tool: any) => {
    if (tool.isPremium && !isLoggedIn) {
      onOpenLogin();
    } else {
      onSelectTool(tool.id);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleToolClick(tool)}
          className="group relative flex flex-col h-[200px] p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[28px] hover:bg-[var(--hover-color)] hover:border-[var(--text-secondary)] transition-all duration-300 text-left overflow-hidden hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-1"
        >
          {/* Background Glow Effect */}
          <div className="absolute -inset-px bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  tool.isPremium && !isLoggedIn ? 'bg-[var(--bg-main)] text-[var(--text-secondary)]' : 'bg-[var(--bg-main)] text-[var(--accent-color)] group-hover:bg-[var(--bg-surface)]'
                }`}>
                  <tool.icon className="w-6 h-6" />
                </div>
                
                {tool.isPremium && (
                  <div className="flex items-center gap-1.5">
                    {!isLoggedIn && <Lock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 rounded-full">
                      <Sparkles className="w-3 h-3 text-[var(--accent-color)]" />
                      <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">高级版</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mb-2">
                <h3 className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors leading-tight">
                  {tool.name}
                </h3>
                {tool.subName && (
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">{tool.subName}</p>
                )}
              </div>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
                {tool.description}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 duration-300">
                {tool.isPremium && !isLoggedIn ? '立即解锁' : '打开工具'}
              </span>
              <div className="w-9 h-9 rounded-full bg-[var(--bg-main)] flex items-center justify-center group-hover:bg-[var(--accent-color)] transition-all duration-300 group-hover:scale-110">
                <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white" />
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
