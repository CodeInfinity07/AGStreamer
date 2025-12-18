import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { voiceConfigSchema, type VoiceConfig, type SavedChannel } from "@shared/schema";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, Edit2, Trash2, Plus, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConfigFormProps {
  defaultValues?: Partial<VoiceConfig>;
  onValuesChange?: (values: VoiceConfig) => void;
  disabled?: boolean;
}

export function ConfigForm({ defaultValues, onValuesChange, disabled }: ConfigFormProps) {
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SavedChannel | null>(null);
  const [channelName, setChannelName] = useState("");

  const form = useForm<VoiceConfig>({
    resolver: zodResolver(voiceConfigSchema),
    defaultValues: {
      appId: defaultValues?.appId || "",
      channelId: defaultValues?.channelId || "",
      userId: defaultValues?.userId || "",
      token: defaultValues?.token || "",
    },
  });

  // Fetch saved channels
  const { data: savedChannelsData, isLoading: isLoadingChannels } = useQuery<{ channels: SavedChannel[] }>({
    queryKey: ["/api/channels/saved"],
  });

  const savedChannels = savedChannelsData?.channels || [];

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; appId: string; channelId: string; userId: string; token?: string }) => {
      return apiRequest("POST", "/api/channels/saved", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/saved"] });
      toast({ title: "Channel saved successfully" });
      setShowSaveDialog(false);
      setChannelName("");
    },
    onError: () => {
      toast({ title: "Failed to save channel", variant: "destructive" });
    },
  });

  // Update channel mutation
  const updateChannelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SavedChannel> }) => {
      return apiRequest("PUT", `/api/channels/saved/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/saved"] });
      toast({ title: "Channel updated successfully" });
      setShowEditDialog(false);
      setEditingChannel(null);
    },
    onError: () => {
      toast({ title: "Failed to update channel", variant: "destructive" });
    },
  });

  // Delete channel mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/channels/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/saved"] });
      toast({ title: "Channel deleted" });
      setSelectedChannelId("");
    },
    onError: () => {
      toast({ title: "Failed to delete channel", variant: "destructive" });
    },
  });

  // Handle selecting a saved channel
  const handleSelectChannel = (channelId: string) => {
    if (channelId === "none") {
      setSelectedChannelId("none");
      form.reset({
        appId: "",
        channelId: "",
        userId: "",
        token: "",
      });
      return;
    }

    setSelectedChannelId(channelId);
    const channel = savedChannels.find(c => c.id === channelId);
    if (channel) {
      form.reset({
        appId: channel.appId,
        channelId: channel.channelId,
        userId: channel.userId,
        token: channel.token || "",
      });
    }
  };

  // Handle saving current config as new channel
  const handleSaveChannel = () => {
    const values = form.getValues();
    if (!values.appId || !values.channelId || !values.userId) {
      toast({ 
        title: "Cannot save", 
        description: "Please fill in App ID, Channel ID, and User ID first",
        variant: "destructive" 
      });
      return;
    }
    setShowSaveDialog(true);
  };

  // Handle confirming save
  const handleConfirmSave = () => {
    const values = form.getValues();
    createChannelMutation.mutate({
      name: channelName,
      appId: values.appId,
      channelId: values.channelId,
      userId: values.userId,
      token: values.token || undefined,
    });
  };

  // Handle editing a channel
  const handleEditChannel = () => {
    const channel = savedChannels.find(c => c.id === selectedChannelId);
    if (channel) {
      setEditingChannel(channel);
      setChannelName(channel.name);
      setShowEditDialog(true);
    }
  };

  // Handle confirming edit
  const handleConfirmEdit = () => {
    if (editingChannel) {
      const values = form.getValues();
      updateChannelMutation.mutate({
        id: editingChannel.id,
        data: {
          name: channelName,
          appId: values.appId,
          channelId: values.channelId,
          userId: values.userId,
          token: values.token || undefined,
        },
      });
    }
  };

  // Handle deleting a channel
  const handleDeleteChannel = () => {
    if (selectedChannelId) {
      deleteChannelMutation.mutate(selectedChannelId);
    }
  };

  // Notify parent of value changes
  const handleChange = () => {
    const currentValues = form.getValues();
    if (form.formState.isValid) {
      onValuesChange?.(currentValues);
    }
  };

  // Watch for form changes
  useEffect(() => {
    const subscription = form.watch(() => handleChange());
    return () => subscription.unsubscribe();
  }, [form.watch]);

  return (
    <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
      {/* Saved Channels Section */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4" />
          Saved Channels
        </Label>
        <div className="flex gap-2">
          <Select 
            value={selectedChannelId} 
            onValueChange={handleSelectChannel}
            disabled={disabled}
          >
            <SelectTrigger 
              className="flex-1 h-10" 
              data-testid="select-saved-channel"
            >
              <SelectValue placeholder={isLoadingChannels ? "Loading..." : "Select a saved channel"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Configuration
                </span>
              </SelectItem>
              {savedChannels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Action buttons */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleSaveChannel}
            disabled={disabled}
            title="Save as new channel"
            data-testid="button-save-channel"
          >
            <Save className="w-4 h-4" />
          </Button>
          
          {selectedChannelId && selectedChannelId !== "none" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleEditChannel}
                disabled={disabled}
                title="Edit channel"
                data-testid="button-edit-channel"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleDeleteChannel}
                disabled={disabled || deleteChannelMutation.isPending}
                title="Delete channel"
                data-testid="button-delete-channel"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-4" />

      <div className="space-y-2">
        <Label htmlFor="appId" className="text-sm font-semibold">
          App ID
        </Label>
        <Input
          id="appId"
          type="text"
          placeholder="Enter your Agora App ID"
          className={cn(
            "h-12 px-4 text-[15px]",
            form.formState.errors.appId && "border-destructive"
          )}
          disabled={disabled}
          data-testid="input-app-id"
          {...form.register("appId", { onChange: handleChange })}
        />
        {form.formState.errors.appId && (
          <p className="text-sm text-destructive">{form.formState.errors.appId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="channelId" className="text-sm font-semibold">
          Channel ID
        </Label>
        <Input
          id="channelId"
          type="text"
          placeholder="Enter channel name"
          className={cn(
            "h-12 px-4 text-[15px]",
            form.formState.errors.channelId && "border-destructive"
          )}
          disabled={disabled}
          data-testid="input-channel-id"
          {...form.register("channelId", { onChange: handleChange })}
        />
        {form.formState.errors.channelId && (
          <p className="text-sm text-destructive">{form.formState.errors.channelId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="userId" className="text-sm font-semibold">
          User ID
        </Label>
        <Input
          id="userId"
          type="text"
          placeholder="Enter your user ID"
          className={cn(
            "h-12 px-4 text-[15px]",
            form.formState.errors.userId && "border-destructive"
          )}
          disabled={disabled}
          data-testid="input-user-id"
          {...form.register("userId", { onChange: handleChange })}
        />
        {form.formState.errors.userId && (
          <p className="text-sm text-destructive">{form.formState.errors.userId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="token" className="text-sm font-semibold">
          Token <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="token"
          type="text"
          placeholder="Enter token or leave empty for testing"
          className="h-12 px-4 text-[15px]"
          disabled={disabled}
          data-testid="input-token"
          {...form.register("token", { onChange: handleChange })}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty if App Certificate is not enabled for your project
        </p>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Channel Configuration</DialogTitle>
            <DialogDescription>
              Give this configuration a name to save it for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="channelName">Configuration Name</Label>
            <Input
              id="channelName"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g., My Test Channel"
              data-testid="input-channel-name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={!channelName || createChannelMutation.isPending}
              data-testid="button-confirm-save"
            >
              {createChannelMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Channel Configuration</DialogTitle>
            <DialogDescription>
              Update the name for this saved configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="editChannelName">Configuration Name</Label>
            <Input
              id="editChannelName"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g., My Test Channel"
              data-testid="input-edit-channel-name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={!channelName || updateChannelMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateChannelMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function useConfigForm() {
  return useForm<VoiceConfig>({
    resolver: zodResolver(voiceConfigSchema),
    defaultValues: {
      appId: "",
      channelId: "",
      userId: "",
      token: "",
    },
  });
}
