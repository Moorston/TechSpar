import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { getResumeStatus, uploadResume, startInterview } from "../api/interview";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskStatus } from "../contexts/TaskStatusContext";

export default function ResumeInterview() {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { creatingSessionMode, setCreatingSessionMode } = useTaskStatus();
  const loading = creatingSessionMode === "resume";

  useEffect(() => {
    getResumeStatus()
      .then((s) => {
        if (s.has_resume) setResumeFile({ filename: s.filename, size: s.size });
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadResume(file);
      setResumeFile({ filename: data.filename, size: data.size });
    } catch (err) {
      alert("上传失败: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStart = async () => {
    if (!resumeFile) return;
    setCreatingSessionMode("resume");
    try {
      const data = await startInterview("resume");
      navigate(`/interview/${data.session_id}`, { state: data });
    } catch (err) {
      alert("启动失败: " + err.message);
    } finally {
      setCreatingSessionMode(null);
    }
  };

  return (
    <div className="flex-1 w-full max-w-[700px] mx-auto px-4 py-6 md:px-7 md:py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={20} className="text-primary" />
          <div className="text-2xl md:text-[28px] font-display font-bold">简历模拟面试</div>
        </div>
        <div className="text-sm text-dim">
          AI 读取你的简历，模拟真实面试官。从自我介绍到项目深挖，完整走一遍面试流程
        </div>
      </div>

      {pageLoading ? (
        <Skeleton className="h-[80px] rounded-xl mb-8" />
      ) : resumeFile ? (
        <Card className="mb-8 hover:shadow-md transition-shadow">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-text">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText size={18} className="text-primary" />
              </div>
              <div>
                <div className="font-medium">{resumeFile.filename}</div>
                <div className="text-xs text-dim">{(resumeFile.size / 1024).toFixed(0)} KB</div>
              </div>
            </div>
            <label className={cn("cursor-pointer", uploading && "opacity-50 pointer-events-none")}>
              <Button variant="outline" size="sm" asChild>
                <span>{uploading ? "上传中..." : "重新上传"}</span>
              </Button>
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </CardContent>
        </Card>
      ) : (
        <label className={cn(
          "flex flex-col items-center gap-3 px-5 py-8 bg-card border-2 border-dashed border-border rounded-xl cursor-pointer transition-all text-sm text-dim hover:border-primary/50 hover:bg-card/80 mb-8",
          uploading && "opacity-50 pointer-events-none"
        )}>
          <div className="w-12 h-12 rounded-xl bg-hover flex items-center justify-center">
            <FileText size={24} className="text-dim" />
          </div>
          <div>
            <span className="font-medium text-text">{uploading ? "正在上传..." : "点击上传简历（PDF）"}</span>
          </div>
          <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {loading ? (
        <div className="w-full rounded-2xl bg-card border border-primary/20 p-6 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 dark:bg-primary/10 animate-pulse pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-dot" />
            </div>
            <div className="text-[14px] font-medium text-primary tracking-wide">
              正在读取简历，构建专属面试方案...
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[320px] mt-2 relative z-10 opacity-70">
            <Skeleton className="w-full h-2.5 rounded-full bg-primary/20" />
            <Skeleton className="w-[85%] h-2.5 rounded-full bg-primary/20" />
            <Skeleton className="w-[60%] h-2.5 rounded-full bg-primary/20" />
          </div>
        </div>
      ) : (
        <Button
          variant="gradient"
          size="lg"
          className="w-full py-6 text-[15px] tracking-wide"
          disabled={!resumeFile}
          onClick={handleStart}
        >
          开始模拟面试
        </Button>
      )}
    </div>
  );
}
