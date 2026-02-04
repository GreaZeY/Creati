import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TemplateEditorProps {
  platform: string;
  initialTitle?: string;
  initialBody?: string;
  onSave: (template: { title: string; body: string }) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  platform,
  initialTitle = "",
  initialBody = "🔥 New video dropped!\n\n{{title}}\n\nWatch here 👇\n{{url}}",
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);

  const insertVariable = (v: string) => {
    setBody((prev) => prev + ` {{${v}}} `);
  };

  const variables = ["title", "url", "platform", "published_at", "emoji"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Editor Column */}
      <div className="space-y-4 flex flex-col h-full">
        <div className="space-y-2">
          <Label>Title Template (Optional)</Label>
          <Input
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(e.target.value)
            }
            placeholder="Announcing: {{title}}"
            className="bg-background/50"
          />
        </div>

        <div className="space-y-2 flex-1 flex flex-col">
          <div className="flex justify-between items-center">
            <Label>Message Body</Label>
            <div className="flex gap-1">
              {variables.map((v) => (
                <span
                  key={v}
                  className="cursor-pointer hover:bg-primary/10 transition-colors text-xs px-2 py-0.5 rounded-full border border-border"
                  onClick={() => insertVariable(v)}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 font-mono text-sm bg-background/50 resize-none min-h-[200px] w-full rounded-md border border-input px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Write your announcement..."
          />
        </div>
        <Button onClick={() => onSave({ title, body })}>Save Template</Button>
      </div>

      {/* Preview Column */}
      <div className="bg-muted/30 rounded-lg border border-border/50 p-4 flex flex-col">
        <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
          Preview ({platform})
        </h4>

        <Card className="flex-1 overflow-hidden shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20"></div>
              <div>
                <div className="h-3 w-24 bg-primary/10 rounded mb-1"></div>
                <div className="h-2 w-16 bg-muted rounded"></div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {title && (
              <h3 className="font-bold text-lg">
                {title.replace("{{title}}", "My Awesome Video")}
              </h3>
            )}
            <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
              {body
                .replace("{{title}}", "My Awesome Video")
                .replace("{{url}}", "https://youtu.be/xyz123")
                .replace("{{platform}}", "YouTube")
                .replace("{{emoji}}", "🔥")}
            </p>

            {/* Mock Embed */}
            <div className="aspect-video bg-muted rounded-md flex items-center justify-center text-muted-foreground border border-border/50">
              <span className="text-xs uppercase tracking-widest">
                Video Embed
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
