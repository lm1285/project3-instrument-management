import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Dropdown,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import dayjs from "dayjs";
import apiClient from "../../services/apiClient";
import { PermissionGuard } from "../auth/components/PermissionGuard";
import "./OneClickTransferPage.css";
import "./MappingSettings.css";

/** Detach uploads from the browser's live local-file handle. */
const snapshotUploadFile = async (file: File): Promise<File> => {
  const buffer = await file.arrayBuffer();
  return new File([buffer], file.name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
};

type UploadTemplate = {
  id: string;
  template_name: string;
  template_group_name?: string;
  template_item_name?: string;
  match_column?: string;
  match_column_enabled?: number;
  headers?: string[];
};
type ImportTemplate = {
  id: string;
  name: string;
  template_group_name?: string;
  template_item_name?: string;
  header_row: number;
  data_start_row: number;
  file_name?: string;
  headers?: string[];
  match_column?: string;
  match_column_enabled?: number;
};
type QuoteTemplate = {
  id: string;
  name: string;
  template_group_name?: string;
  template_item_name?: string;
  header_row: number;
  data_start_row: number;
  file_name?: string;
  headers?: string[];
  updated_at?: string;
  created_at?: string;
};

/** Show the parent/sub-format relationship when template metadata provides it. */
const templateLabel = (item: any, fallback = "未命名模板") => {
  const group = item?.template_group_name || item?.templateGroupName || item?.parent_name || item?.template_group;
  const itemName = item?.template_item_name || item?.templateItemName || item?.name || item?.template_name || item?.type_name;
  if (group && itemName) return `${group} / ${itemName}`;
  return itemName || group || fallback;
};
const templateGroupName = (item: any, fallback: string) =>
  item?.template_group_name || item?.templateGroupName || item?.parent_name || item?.template_group || fallback;
const templateItemName = (item: any, fallback: string) =>
  item?.template_item_name || item?.templateItemName || item?.name || item?.template_name || item?.type_name || fallback;
const TEMPLATE_GROUP_NAMES = {
  quote: "报价单模板组",
  import: "导入格式模板组",
  order: "收发委托模板组",
  target: "转送对象模板组",
} as const;

const emptyConfig = { uploadTemplates: [], orderTemplates: [], importTemplates: [], quoteTemplates: [], importMappings: [], quoteMappings: [], quoteOrderMappings: [], targetTemplates: [], monitoring: { summary: { ok: 0, warning: 0, error: 0 }, templates: [], mappings: [] }, settings: {} };
const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const EXCEL_FILE_ACCEPT = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
const taskPreviewColumns = ["仪器名称", "型号规格", "制造厂", "出厂编号", "管理编号", "测量范围", "备注"];
const getPreviewRows = (file: any) => {
  try {
    const rows = JSON.parse(file?.preview_data_json || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const OneClickTransferPage: React.FC = () => {
  const { message: appMessage } = App.useApp();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [config, setConfig] = useState<any>(emptyConfig);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [settingsTab, setSettingsTab] = useState("templates");
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [baseInfo, setBaseInfo] = useState<any>({});
  const [sourceFile, setSourceFile] = useState<UploadFile | null>(null);
  const [importTemplateId, setImportTemplateId] = useState<string>();
  const [orderTemplateId, setOrderTemplateId] = useState<string>();
  const [quoteTemplateId, setQuoteTemplateId] = useState<string>();
  const [sourceType, setSourceType] = useState<"quote" | "import" | "order">("quote");
  const [generationMode, setGenerationMode] = useState<"import" | "target" | "order" | "all">("all");
  const [processing, setProcessing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<dayjs.Dayjs | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticRequestId, setDiagnosticRequestId] = useState("");
  const [sourceDetection, setSourceDetection] = useState<{ status: "success" | "warning" | "error"; message: string } | null>(null);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (loadInFlightRef.current) return loadInFlightRef.current;
    if (!options?.silent) setRefreshing(true);
    const request = (async () => {
      try {
        const [c, t] = await Promise.all([
          apiClient.get("/one-click-transfer/config", { disableCache: true }),
          apiClient.get("/one-click-transfer/tasks", { disableCache: true }),
        ]);
        if (c.success) setConfig(c.data || emptyConfig);
        if (t.success) setTasks(t.data || []);
        setLastUpdatedAt(dayjs());
      } catch (error: any) {
        if (!options?.silent) appMessage.error(error?.message || "刷新转送数据失败");
      } finally {
        if (!options?.silent) setRefreshing(false);
        loadInFlightRef.current = null;
      }
    })();
    loadInFlightRef.current = request;
    return request;
  }, [appMessage]);
  useEffect(() => {
    void load();
  }, [load]);
  const downloadDiagnosticBundle = async () => {
    try {
      const blob = await apiClient.download("/audits/diagnostic.zip", {
        params: {
          request_id: diagnosticRequestId.trim() || undefined,
          hours: 24,
          maxBytes: 8 * 1024 * 1024,
        },
        timeout: 60000,
      });
      downloadBlob(blob, diagnosticRequestId.trim() ? `diagnostic_logs_${diagnosticRequestId.trim().slice(0, 16)}.zip` : "diagnostic_logs.zip");
      appMessage.success("诊断日志已下载");
    } catch (error: any) {
      appMessage.error(error?.message || "诊断日志下载失败");
    }
  };
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };

    const timer = window.setInterval(refreshWhenVisible, 15_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load({ silent: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const deleteTask = async (task: any) => {
    try {
      await apiClient.delete(`/one-click-transfer/tasks/${task.id}`);
      if (selectedTask?.id === task.id) setSelectedTask(null);
      await load();
      appMessage.success("任务已删除");
    } catch (error: any) {
      appMessage.error(error.message || "删除任务失败");
    }
  };
  const parseHeaders = async (file: File) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const workbook = (await import("xlsx")).read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = (await import("xlsx")).utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
    });
    const detectForm = new FormData();
    detectForm.append("file", file);
    const detectionResponse: any = await apiClient.upload("/one-click-transfer/detect-source", detectForm);
    const best = detectionResponse?.data?.best;
    if (best?.confident) {
      const detectedType = best.type as "quote" | "import" | "order";
      const defaultMode = detectedType === "quote" ? "all" : "target";
      setSourceType(detectedType);
      setGenerationMode(defaultMode);
      form.setFieldsValue({ sourceType: detectedType, generationMode: defaultMode });
      if (detectedType === "quote") { setQuoteTemplateId(best.id); form.setFieldsValue({ quoteTemplateId: best.id }); }
      else if (detectedType === "import") { setImportTemplateId(best.id); form.setFieldsValue({ importTemplateId: best.id }); }
      else { setOrderTemplateId(best.id); form.setFieldsValue({ orderTemplateId: best.id }); }
      setSourceDetection({ status: "success", message: `已自动识别：${best.groupName} / ${best.itemName}` });
      return;
    }
    setSourceDetection({ status: "warning", message: best ? `无法可靠区分文件类型，最接近“${best.groupName} / ${best.itemName}”，请人工确认。` : "未找到可用于识别的模板，请先完成模板配置。" });
    const selectedSourceType = form.getFieldValue("sourceType") || sourceType;
    const selectedTemplateId = selectedSourceType === "quote" ? (form.getFieldValue("quoteTemplateId") || quoteTemplateId) : selectedSourceType === "import" ? (form.getFieldValue("importTemplateId") || importTemplateId) : (form.getFieldValue("orderTemplateId") || orderTemplateId);
    const template = selectedSourceType === "quote"
      ? (config.quoteTemplates || []).find((item: QuoteTemplate) => item.id === selectedTemplateId)
      : selectedSourceType === "import"
        ? (config.importTemplates || []).find((item: ImportTemplate) => item.id === selectedTemplateId)
        : (config.orderTemplates || config.uploadTemplates || []).find((item: UploadTemplate) => item.id === selectedTemplateId);
    const detectedHeaders = (rows[(template?.header_row || 1) - 1] || [])
        .map((item: any) => String(item).trim())
        .filter(Boolean);
    if (detectedHeaders.length) {
      const candidates = selectedSourceType === "quote" ? config.quoteTemplates || [] : selectedSourceType === "import" ? config.importTemplates || [] : config.orderTemplates || config.uploadTemplates || [];
      const ranked = candidates.map((item: any) => ({ item, score: (item.headers || []).filter((h: string) => detectedHeaders.includes(h)).length })).sort((a: any, b: any) => b.score - a.score);
      if (ranked[0]?.score > 0 && ranked[0].item.id !== selectedTemplateId) {
        if (selectedSourceType === "quote") { setQuoteTemplateId(ranked[0].item.id); form.setFieldsValue({ quoteTemplateId: ranked[0].item.id }); }
        else if (selectedSourceType === "import") { setImportTemplateId(ranked[0].item.id); form.setFieldsValue({ importTemplateId: ranked[0].item.id }); }
        else { setOrderTemplateId(ranked[0].item.id); form.setFieldsValue({ orderTemplateId: ranked[0].item.id }); }
      }
    }
  };
  const selectSourceFile = async (file: File) => {
    try {
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        throw new Error("待处理文件大小不能超过100MB");
      }
      const snapshot = await snapshotUploadFile(file);
      setSourceFile({
        uid: `source-${snapshot.lastModified}`,
        name: snapshot.name,
        size: snapshot.size,
        type: snapshot.type,
        status: "done",
        originFileObj: snapshot as any,
      });
      await parseHeaders(snapshot);
    } catch (error: any) {
      setSourceFile(null);
      setSourceDetection({ status: "error", message: error?.message || "读取Excel文件失败" });
      appMessage.error(error?.message || "读取Excel文件失败");
    }

    return false;
  };
  const removeSourceFile = () => {
    setSourceFile(null);
    setSourceDetection(null);
  };
  const handleMobileSourceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void selectSourceFile(file);
    }
  };
  const submit = async () => {
    try {
      const formValues = form.getFieldsValue(true);
      // Keep wizard fields when step 1 has been unmounted by the step switch.
      const values = { ...formValues, ...baseInfo };
      if (!sourceFile) return appMessage.error("请上传Excel文件");
      const selectedSourceType = values.sourceType || sourceType;
      const selectedQuoteTemplateId = values.quoteTemplateId || quoteTemplateId;
      const selectedImportTemplateId = values.importTemplateId || importTemplateId;
      const selectedOrderTemplateId = values.orderTemplateId || orderTemplateId;
      const selectedSourceTemplateId = selectedSourceType === "quote" ? selectedQuoteTemplateId : selectedSourceType === "import" ? selectedImportTemplateId : selectedOrderTemplateId;
      if (!selectedSourceTemplateId) return appMessage.error("请先配置并选择源模板");
       if (selectedSourceType === "quote" && values.generationMode === "import" && !selectedImportTemplateId) return appMessage.error("请先选择导入格式模板");
      if ((selectedSourceType === "quote" || selectedSourceType === "import") && (values.generationMode === "order" || values.generationMode === "all") && !selectedOrderTemplateId) return appMessage.error("请先选择收发委托单模板");
      setProcessing(true);
      const data = new FormData();
      if (!sourceFile.originFileObj) throw new Error("待处理文件无效，请重新选择");
      data.append("file", sourceFile.originFileObj);
      Object.entries(values).forEach(([key, value]) =>
        data.append(
          key,
          dayjs.isDayjs(value)
            ? (value as any).format("YYYY-MM-DD")
            : String(value ?? ""),
        ),
      );
      data.set("importTemplateId", selectedImportTemplateId);
      data.set("orderTemplateId", selectedOrderTemplateId);
      data.set("quoteTemplateId", selectedQuoteTemplateId || "");
      data.set("sourceTemplateId", selectedSourceTemplateId);
      data.set("sourceType", selectedSourceType);
      data.set("generationMode", values.generationMode || generationMode);
      data.set("templateItemName", config.importTemplates?.find((item: ImportTemplate) => item.id === selectedImportTemplateId)?.template_item_name || config.importTemplates?.find((item: ImportTemplate) => item.id === selectedImportTemplateId)?.name || "");
      const response = await apiClient.upload(
        "/one-click-transfer/process",
        data,
        // Excel generation is synchronous on the backend and can legitimately
        // exceed the normal API timeout for larger workbooks.
        { timeout: 120000 },
      );
      if (!response.success) throw new Error(response.message);
      appMessage.success("处理完成");
      setModalOpen(false);
      setActiveTab("completed");
      await load();
      setSelectedTask(null);
    } catch (error: any) {
      appMessage.error(error.message || "处理失败");
    } finally {
      setProcessing(false);
    }
  };
  const download = async (endpoint: string, filename: string) => {
    try {
      const blob = await apiClient.download(endpoint);
      downloadBlob(blob, filename);
    } catch (error: any) {
      appMessage.error(error.message || "下载失败");
    }
  };
  const pendingPanel = (
    <Card className="transfer-empty">
      <ThunderboltOutlined className="transfer-empty-icon" />
      <h2>一键转送</h2>
      <p>上传总表，按匹配列自动生成转送文件</p>
      <Button
        type="primary"
        size="large"
        icon={<ThunderboltOutlined />}
        onClick={() => {
          setStep(0);
          setBaseInfo({});
          form.resetFields();
           const latestQuote = [...(config.quoteTemplates || [])].sort((a: QuoteTemplate, b: QuoteTemplate) =>
            String(b.updated_at || b.created_at || "").localeCompare(
              String(a.updated_at || a.created_at || ""),
            ),
          )[0];
           const latestImport = config.importTemplates?.[0];
           const order = config.orderTemplates?.[0] || config.uploadTemplates?.[0];
           if (latestQuote) {
             setQuoteTemplateId(latestQuote.id);
             form.setFieldsValue({ quoteTemplateId: latestQuote.id });
           }
           if (latestImport) { setImportTemplateId(latestImport.id); form.setFieldsValue({ importTemplateId: latestImport.id }); }
           if (order) {
             setOrderTemplateId(order.id);
             form.setFieldsValue({ orderTemplateId: order.id });
           }
           setSourceType("quote");
           form.setFieldsValue({ sourceType: "quote", generationMode: "all" });
           setGenerationMode("all");
          setSourceFile(null);
          setModalOpen(true);
        }}
      >
        开始处理
      </Button>
    </Card>
  );
  /* Processing is synchronous: completed output is available when submit resolves. */
  const processingPanel = selectedTask ? (
    <Card className="transfer-processing-card">
      <div className="transfer-summary">
        <Statistic
          title="总行数"
          value={selectedTask.totalRows ?? selectedTask.total_rows}
        />
        <Statistic
          title="已匹配"
          value={selectedTask.matchedRows ?? selectedTask.matched_rows}
          valueStyle={{ color: "#16a34a" }}
        />
        <Statistic
          title="已跳过"
          value={selectedTask.skippedRows ?? selectedTask.skipped_rows}
          valueStyle={{ color: "#dc2626" }}
        />
      </div>
      <Row gutter={[16, 16]}>
        {(selectedTask.files || []).map((file: any) => (
          <Col xs={24} sm={12} lg={8} key={file.id}>
            <Card size="small" title={templateLabel(file, file.templateName || file.template_name || "转送文件")}>
              <Tag color="blue">{file.rowCount ?? file.row_count} 行</Tag>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() =>
                  download(
                    `/one-click-transfer/files/${file.id}/download`,
                    file.filename,
                  )
                }
              >
                下载
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  ) : (
    <Card>
      <p>暂无处理中任务，提交任务后会在此显示处理总览。</p>
    </Card>
  );
  void processingPanel;
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const completedPanel = (
    <div className={`transfer-completed ${completedTasks.length ? "has-tasks" : "is-empty"}`}>
      <div className="completed-intro">
        <div>
          <span className="completed-kicker">TRANSFER RESULTS</span>
          <h2>已完成的转送</h2>
          <p>按任务查看转送对象、模板文件和处理结果。</p>
        </div>
        <div className="completed-intro-note"><CheckCircleOutlined /> 结果已生成，可直接下载</div>
      </div>
      <Row className="transfer-completed-summary" gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card className="completed-stat completed-stat-success"><Statistic title="已完成任务" value={completedTasks.length} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="completed-stat completed-stat-files"><Statistic title="累计生成文件" value={completedTasks.reduce((sum, task) => sum + (task.files?.length || 0), 0)} prefix={<FolderOpenOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="completed-stat completed-stat-skipped"><Statistic title="累计跳过行" value={completedTasks.reduce((sum, task) => sum + (task.skipped_rows ?? task.skippedRows ?? 0), 0)} prefix={<ArrowRightOutlined />} /></Card>
        </Col>
      </Row>
      {completedTasks.length === 0 && (
        <Card className="completed-no-results">
          <img className="completed-no-results-illustration" src="/one-click-transfer-empty-state.png" alt="数据转送完成示意图" />
          <h3>完成的结果会出现在这里</h3>
          <p>处理任务后，你可以在这里按转送对象查看并下载生成文件。</p>
        </Card>
      )}
      {completedTasks.map((task) => {
        const taskFiles = Array.isArray(task.files) ? task.files : [];
        const fileGroups = groupTransferFiles(taskFiles);
        const totalRows = task.total_rows ?? task.totalRows ?? 0;
        const matchedRows = task.matched_rows ?? task.matchedRows ?? 0;
        const skippedRows = task.skipped_rows ?? task.skippedRows ?? 0;
        const completedAt = task.completed_at || task.completedAt || task.created_at;
        const selectedFile = taskFiles.find((file: any) => file.match_keyword === selectedCategory) || taskFiles[0];
        return (
          <Card
            key={task.id}
            className={`task-card ${selectedTask?.id === task.id ? "is-expanded" : ""}`}
            role="button"
            tabIndex={0}
            aria-expanded={selectedTask?.id === task.id}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const collapsing = selectedTask?.id === task.id;
                setSelectedTask(collapsing ? null : task);
                if (!collapsing) setSelectedCategory(taskFiles[0]?.match_keyword || "");
              }
            }}
            title={undefined}
            extra={
              <Space wrap className="task-card-actions">
                <Button type="primary" icon={<DownloadOutlined />} onClick={(event) => { event.stopPropagation(); void download(`/one-click-transfer/tasks/${task.id}/download`, taskArchiveName(task)); }}>
                  下载全部文件
                </Button>
                <Popconfirm title="确认删除此任务？" onConfirm={() => deleteTask(task)}>
                  <Button danger icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>删除</Button>
                </Popconfirm>
              </Space>
            }
            onClick={() => {
              const collapsing = selectedTask?.id === task.id;
              setSelectedTask(collapsing ? null : task);
              if (!collapsing) setSelectedCategory(taskFiles[0]?.match_keyword || "");
            }}
          >
            <div className="task-card-title-row">
              <div className="task-card-title-wrap">
                <span className="task-status-pill"><CheckCircleOutlined /> 已完成</span>
                <h3 title={task.source_filename || task.folder_name}>{task.folder_name || "转送任务"}</h3>
                <p className="task-source-file"><FileExcelOutlined /> {task.source_filename || "未命名源文件"}</p>
              </div>
              <span className="task-expand-hint">{selectedTask?.id === task.id ? "收起详情" : "查看详情"} <ArrowRightOutlined /></span>
            </div>
            <div className="task-meta-row">
              <span>总行数 <b>{totalRows}</b></span>
              <span>已匹配 <b className="is-success">{matchedRows}</b></span>
              <span>已跳过 <b className="is-warning">{skippedRows}</b></span>
              {completedAt && <span className="task-completed-at">完成于 {dayjs(completedAt).format("YYYY-MM-DD HH:mm")}</span>}
            </div>
            <div className="task-output-heading"><span>生成文件</span><span>{taskFiles.length} 个文件 · {fileGroups.length} 个模板组</span></div>
            {selectedTask?.id === task.id && <>
            <div className="task-output-groups">
              {fileGroups.map((group) => (
                <section className="task-output-group" key={group.name}>
                  <div className="task-output-group-heading"><span>{group.name}</span><small>{group.files.length} 个文件</small></div>
                  <div className="task-file-list">
                    {group.files.map((file: any) => (
                      <div className={`task-file-row ${selectedTask?.id === task.id && selectedFile?.id === file.id ? "is-selected" : ""}`} key={file.id}>
                        <span className="task-file-icon"><FileExcelOutlined /></span>
                        <div className="task-file-main">
                          <strong title={file.template_item_name || file.template_name || file.match_keyword}>{file.template_item_name || file.template_name || file.match_keyword || "生成文件"}</strong>
                          <span title={file.filename}>{file.filename || "未命名文件.xlsx"}</span>
                          <small><Tag>{file.match_keyword || "转送对象"}</Tag><em>{file.row_count ?? file.rowCount ?? 0} 行</em></small>
                        </div>
                        <div className="task-file-actions">
                          <Button type="link" onClick={(event) => { event.stopPropagation(); setSelectedTask(task); setSelectedCategory(file.match_keyword || ""); }}>预览</Button>
                          <Button icon={<DownloadOutlined />} aria-label={`下载${file.filename || "当前文件"}`} onClick={(event) => { event.stopPropagation(); void download(`/one-click-transfer/files/${file.id}/download`, file.filename || "转送文件.xlsx"); }}>下载</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            </>}
            {(() => { const details = getSkipDetails(task); return (details.excluded.length || details.unmatched) ? <div className="task-skip-details"><span>已跳过</span>{details.excluded.map((item) => <span key={item.keyword}>排除项 {item.keyword}：{item.count} 行</span>)}{details.unmatched > 0 && <span>未匹配到转送对象：{details.unmatched} 行</span>}</div> : null; })()}
            {selectedTask?.id === task.id && (
              <div className="category-area" onClick={(event) => event.stopPropagation()}>
                <div className="category-area-header">
                  <div><strong>文件预览</strong><span>选择文件查看生成结果</span></div>
                  <Button icon={<DownloadOutlined />} onClick={() => download(`/one-click-transfer/tasks/${task.id}/categories/${encodeURIComponent(selectedCategory)}/download`, selectedFile?.filename || `${selectedCategory || "转送文件"}.xlsx`)}>下载当前文件</Button>
                </div>
                <Segmented className="transfer-category-selector" options={taskFiles.map((file: any) => ({ label: `${file.template_item_name || file.match_keyword} · ${file.row_count ?? file.rowCount ?? 0} 行`, value: file.match_keyword }))} value={selectedCategory} onChange={(value) => setSelectedCategory(String(value))} block />
                <Table className="transfer-preview-table" size="small" rowKey={(_, index) => `${selectedCategory}-${index}`} pagination={false} scroll={{ x: 1040 }} locale={{ emptyText: "当前文件暂无预览数据" }} dataSource={getPreviewRows(selectedFile)} columns={taskPreviewColumns.map((title) => ({ title, dataIndex: title, key: title, align: "center" as const, ellipsis: { showTitle: true } }))} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
  const settingsPanel = (
    <Tabs
      className="transfer-settings-tabs"
      activeKey={settingsTab}
      onChange={setSettingsTab}
      items={[
         {
           key: "templates",
           label: "模板配置",
           children: <TemplateSettingsManagerV2 config={config} reload={load} />,
         },
         {
           key: "mappings",
           label: "映射关系",
           children: <UnifiedMappingSettings config={config} reload={load} />,
         },
         {
           key: "monitoring",
           label: <span>运行监控{config.monitoring?.summary?.error > 0 ? <Tag color="error">{config.monitoring.summary.error}</Tag> : null}</span>,
           children: <TransferMonitoringPanel monitoring={config.monitoring} onRefresh={load} refreshing={refreshing} />,
         },
        {
          key: "general",
          label: "通用设置",
          children: (
            <Card>
              <Form layout="vertical">
                <Form.Item label="日期显示格式">
                  <Input
                    defaultValue={config.settings?.dateFormat || "YYYY-MM-DD"}
                  />
                </Form.Item>
                <Button type="primary">保存设置</Button>
              </Form>
            </Card>
          ),
        },
      ]}
    />
  );
  return (
    <div className="one-click-transfer">
      <div className="transfer-header">
        <div>
          <div className="eyebrow">TRANSFER WORKBENCH</div>
          <h1>一键转送</h1>
          <p>按模板组和模板项及匹配列批量生成转送对象文件</p>
        </div>
        <div className="transfer-header-actions">
          <PermissionGuard permission="system:audit:export">
            <Input
              className="diagnostic-request-id"
              placeholder="Request ID（可选）"
              value={diagnosticRequestId}
              onChange={(event) => setDiagnosticRequestId(event.target.value)}
              allowClear
            />
            <Tooltip title="下载诊断日志包，可按 Request ID 精确筛选">
              <Button icon={<DownloadOutlined />} onClick={() => void downloadDiagnosticBundle()}>
                下载诊断包
              </Button>
            </Tooltip>
          </PermissionGuard>
          <span className="transfer-last-updated">
            {lastUpdatedAt ? `上次更新于 ${lastUpdatedAt.format("HH:mm:ss")}` : "正在加载数据"}
          </span>
          <Tooltip title="刷新任务和模板数据">
            <Button
              type="text"
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => void load()}
              aria-label="刷新转送数据"
            />
          </Tooltip>
          <SettingOutlined className="transfer-header-icon" />
        </div>
      </div>
      <Tabs
        className="transfer-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "pending", label: "待处理", children: pendingPanel },
          { key: "completed", label: "已完成", children: completedPanel },
          { key: "settings", label: "设置", children: settingsPanel },
        ]}
      />
      <Modal
        className="transfer-modal"
        title="开始处理"
        open={modalOpen}
        onCancel={() => !processing && setModalOpen(false)}
        width={720}
        footer={null}
        destroyOnClose
      >
        <Steps
          current={step}
          onChange={(nextStep) => {
            if (nextStep === 0) {
              setStep(0);
              return;
            }
            if (step === 0) {
              void form
                .validateFields([
                  "certificateUnit",
                  "certificateAddress",
                  "calibrationDate",
                  "specialRequirements",
                ])
                .then((values) => {
                  setBaseInfo(values);
                  setStep(1);
                })
                .catch(() => undefined);
            } else {
              setStep(nextStep);
            }
          }}
        />
        <div className="transfer-step">
          {step === 0 ? (
            <Form form={form} layout="vertical">
              <Form.Item
                name="certificateUnit"
                label="证书名称"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="certificateAddress"
                label="证书地址"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="calibrationDate"
                label="校准日期"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="specialRequirements" label="特殊要求">
                <Input.TextArea rows={3} placeholder="请输入特殊要求（选填）" />
              </Form.Item>
              <Button
                type="primary"
                onClick={async () => {
                  try {
                    const values = await form.validateFields([
                      "certificateUnit",
                      "certificateAddress",
                      "calibrationDate",
                      "specialRequirements",
                    ]);
                    setBaseInfo(values);
                    setStep(1);
                  } catch {}
                }}
              >
                下一步
              </Button>
            </Form>
          ) : (
            <Form form={form} layout="vertical">
              <Form.Item name="sourceType" label="上传文件类型" initialValue="quote">
                <Radio.Group value={sourceType} onChange={(event) => { const value = event.target.value; setSourceType(value); setSourceFile(null); setSourceDetection(null); const defaultMode = value === "quote" ? "all" : "target"; setGenerationMode(defaultMode); form.setFieldsValue({ sourceType: value, generationMode: defaultMode }); }} options={[{ label: "报价单", value: "quote" }, { label: "导入格式", value: "import" }, { label: "收发委托单", value: "order" }]} />
              </Form.Item>
              {sourceType === "quote" && <Form.Item name="quoteTemplateId" label="报价单模板项" rules={[{ required: true, message: "请选择报价单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择报价单模板项" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: templateLabel(item, "报价单模板"), value: item.id }))} onChange={(value) => { setQuoteTemplateId(value); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "import" && <Form.Item name="importTemplateId" label="导入格式模板项" rules={[{ required: true, message: "请选择导入格式模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板项" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: templateLabel(item, "导入格式模板"), value: item.id }))} onChange={(value) => { setImportTemplateId(value); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "order" && <Form.Item name="orderTemplateId" label="收发委托单模板项" rules={[{ required: true, message: "请选择收发委托单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板项" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: templateLabel(item, "收发委托模板"), value: item.id }))} onChange={(value) => { setOrderTemplateId(value); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "quote" && generationMode === "import" && <Form.Item name="importTemplateId" label="生成所用导入格式模板项" rules={[{ required: true, message: "请选择导入格式模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板项" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: templateLabel(item, "导入格式模板"), value: item.id }))} onChange={setImportTemplateId} /></Form.Item>}
              {(sourceType === "quote" || sourceType === "import") && (generationMode === "order" || generationMode === "all") && <Form.Item name="orderTemplateId" label="生成所用收发委托单模板项" rules={[{ required: true, message: "请选择收发委托单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板项" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: templateLabel(item, "收发委托模板"), value: item.id }))} onChange={setOrderTemplateId} /></Form.Item>}
              <Form.Item name="generationMode" label="生成内容" initialValue={sourceType === "quote" ? "all" : "target"}>
                <Radio.Group value={generationMode} onChange={(event) => { const value = event.target.value; setGenerationMode(value); form.setFieldsValue({ generationMode: value }); if (value === "import" || value === "target") { setOrderTemplateId(undefined); form.setFieldsValue({ orderTemplateId: undefined }); } }} options={sourceType === "quote" ? [{ label: "生成导入格式", value: "import" }, { label: "生成收发委托单", value: "order" }, { label: "生成收发委托单和转送表", value: "all" }] : sourceType === "import" ? [{ label: "生成转送表", value: "target" }, { label: "生成收发委托单", value: "order" }, { label: "生成收发委托单和转送表", value: "all" }] : [{ label: "生成转送表", value: "target" }]} />
              </Form.Item>
              <Form.Item label="上传Excel文件" required>
                {isMobile ? (
                  <div className="transfer-mobile-file-upload">
                    <input
                      ref={sourceFileInputRef}
                      type="file"
                      accept={EXCEL_FILE_ACCEPT}
                      onChange={handleMobileSourceFileChange}
                    />
                    <Button
                      icon={<UploadOutlined />}
                      block
                      onClick={() => sourceFileInputRef.current?.click()}
                    >
                      选择 Excel 待处理文件
                    </Button>
                    {sourceFile && (
                      <div className="transfer-mobile-file-name">
                        <span title={sourceFile.name}>{sourceFile.name}</span>
                        <Button type="link" danger size="small" onClick={removeSourceFile}>
                          移除
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Upload.Dragger
                    accept={EXCEL_FILE_ACCEPT}
                    maxCount={1}
                    fileList={sourceFile ? [sourceFile] : []}
                    beforeUpload={selectSourceFile}
                    onRemove={removeSourceFile}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p>点击或拖拽上传Excel</p>
                  </Upload.Dragger>
                )}
                {sourceDetection && <div className={`transfer-source-detection is-${sourceDetection.status}`} role={sourceDetection.status === "error" ? "alert" : "status"}>{sourceDetection.message}</div>}
              </Form.Item>
              <Space>
                <Button onClick={() => setStep(0)}>上一步</Button>
                <Button type="primary" loading={processing} onClick={submit}>
                  提交处理
                </Button>
              </Space>
            </Form>
          )}
        </div>
      </Modal>
    </div>
  );
};
const Steps = ({
  current,
  onChange,
}: {
  current: number;
  onChange: (value: number) => void;
}) => (
  <div className="transfer-steps">
    <button
      className={current >= 0 ? "active" : ""}
      onClick={() => onChange(0)}
    >
      1<span>基础信息</span>
    </button>
    <i />{" "}
    <button
      className={current >= 1 ? "active" : ""}
      onClick={() => onChange(1)}
    >
      2<span>上传与匹配</span>
    </button>
  </div>
);
const QuoteTemplateSettings = ({ config, reload }: any) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [file, setFile] = useState<File>();
  const [editing, setEditing] = useState<any>();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择报价单模板文件");
    const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.quote);
    if (editing?.id) data.append("id", editing.id); if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/quote-templates", data, { timeout: 120000 }); await reload();
    form.resetFields(); setFile(undefined); setEditing(undefined);
    message.success("模板保存完成");
    } finally {
      setSaving(false);
    }
  };
  const edit = (row: any) => { setEditing(row); form.setFieldsValue({ templateItemName: row.template_item_name || row.name, headerRow: row.header_row, dataStartRow: row.data_start_row }); };
  const remove = async (row: any) => { await apiClient.delete(`/one-click-transfer/quote-templates/${row.id}`); await reload(); };
  return <Card title="报价单模板">
     <Form form={form} layout="vertical" className="transfer-template-form">
      <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true, message: "请输入模板项名称" }]}><Input placeholder="例如：报价单默认格式" /></Form.Item>
       <Form.Item name="headerRow" label="表头行号" initialValue={1} rules={[{ required: true }]}><Input /></Form.Item>
       <Form.Item name="dataStartRow" label="数据起始行号" initialValue={2} rules={[{ required: true }]}><Input /></Form.Item>
       <div className="transfer-template-spacer" aria-hidden="true" />
        <Upload beforeUpload={async (next) => { setFile(await snapshotUploadFile(next)); message.success("Excel 文件上传成功"); return false; }} maxCount={1} accept=".xlsx,.xls"><Button icon={<PlusOutlined />}>选择报价单文件</Button></Upload>
       <div className="transfer-template-current-file">{editing && !file ? `当前文件：${editing.file_name}` : ""}</div>
       <Space className="transfer-template-actions"><Button type="primary" loading={saving} onClick={() => void save().catch((error: any) => message.error(error?.message || "模板保存失败"))}>保存</Button>{editing && <Button disabled={saving} onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
    </Form>
     <Table size="small" pagination={false} rowKey="id" dataSource={config.quoteTemplates || []} columns={[{ title: "模板组名称", dataIndex: "template_group_name" }, { title: "模板项名称", dataIndex: "template_item_name" }, { title: "表头行", dataIndex: "header_row" }, { title: "文件", dataIndex: "file_name" }, { title: "操作", render: (_: any, row: any) => <Space><Button type="link" onClick={() => edit(row)}>修改</Button><Popconfirm title="确定要删除这个模板吗？" okText="确定" cancelText="取消" onConfirm={() => void remove(row).catch((error: any) => message.error(error?.message || "模板删除失败"))}><Button type="link" danger>删除</Button></Popconfirm></Space> }]} />
  </Card>;
};

const ImportTemplateSettings = ({ config, reload }: any) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [file, setFile] = useState<File>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [editing, setEditing] = useState<any>();
  const [saving, setSaving] = useState(false);
  const readHeaders = async (next: File, headerRow = 1) => {
    const workbook = (await import("xlsx")).read(new Uint8Array(await next.arrayBuffer()), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return (await import("xlsx")).utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })[Math.max(0, headerRow - 1)]?.map((value: any) => String(value).trim()).filter(Boolean) || [];
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
    if (form.getFieldValue("matchColumnEnabled") === false) form.setFieldsValue({ matchColumn: "disabled" });
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择导入格式文件");
    const data = new FormData();
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.import);
    Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    if (editing?.id) data.append("id", editing.id);
    if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/import-templates", data, { timeout: 120000 });
    await reload();
    form.resetFields(); setFile(undefined); setEditing(undefined);
    message.success("模板保存完成");
    } finally {
      setSaving(false);
    }
  };
  const edit = (row: any) => { setEditing(row); form.setFieldsValue({ templateItemName: row.template_item_name || row.name, headerRow: row.header_row, dataStartRow: row.data_start_row, matchColumn: row.match_column, matchColumnEnabled: row.match_column_enabled !== 0 }); };
  const remove = async (row: any) => { await apiClient.delete(`/one-click-transfer/import-templates/${row.id}`); await reload(); };
  return <Card title="导入格式模板">
     <Form
       form={form}
       layout="vertical"
       className="transfer-template-form"
       onValuesChange={(changedValues, allValues) => {
         if (file && changedValues.headerRow !== undefined) {
           void readHeaders(file, Number(allValues.headerRow || 1)).then(setHeaders);
         }
       }}
     >
      <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true, message: "请输入模板项名称" }]}><Input placeholder="例如：报价单默认导入格式" /></Form.Item>
      <Form.Item name="headerRow" label="表头行号" initialValue={1} rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="dataStartRow" label="数据起始行号" initialValue={2} rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="matchColumn" label="转送匹配列" rules={[{ required: true, message: "请选择转送匹配列" }]}><Select placeholder={headers.length ? "请选择转送匹配列" : "请先选择Excel文件"} options={headers.map((header) => ({ label: header, value: header }))} /></Form.Item>
       <Form.Item name="matchColumnEnabled" label="启用转送匹配列" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
       <Upload
         fileList={file ? [{ uid: file.name, name: file.name, status: "done" as const }] : []}
          beforeUpload={async (next) => { const snapshot = await snapshotUploadFile(next); setFile(snapshot); message.success("Excel 文件上传成功"); return false; }}
         onRemove={() => { setFile(undefined); return true; }}
         maxCount={1}
         accept=".xlsx,.xls"
       >
         <Button icon={<PlusOutlined />}>选择导入格式文件</Button>
       </Upload>
       <div className="transfer-template-current-file">{editing && !file ? `当前文件：${editing.file_name}` : ""}</div>
       <Space className="transfer-template-actions"><Button type="primary" loading={saving} onClick={() => void save().catch((error: any) => message.error(error?.message || "模板保存失败"))}>保存</Button>{editing && <Button disabled={saving} onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
    </Form>
    <Table size="small" pagination={false} rowKey="id" dataSource={config.importTemplates || []} columns={[
      { title: "模板组名称", dataIndex: "template_group_name" }, { title: "模板项名称", dataIndex: "template_item_name" }, { title: "表头行", dataIndex: "header_row" }, { title: "数据起始行", dataIndex: "data_start_row" }, { title: "文件", dataIndex: "file_name" },
      { title: "操作", render: (_: any, row: any) => <Space><Button type="link" onClick={() => edit(row)}>修改</Button><Popconfirm title="确定要删除这个模板吗？" okText="确定" cancelText="取消" onConfirm={() => void remove(row).catch((error: any) => message.error(error?.message || "模板删除失败"))}><Button type="link" danger>删除</Button></Popconfirm></Space> },
    ]} />
  </Card>;
};

const getSkipDetails = (task: any): { excluded: Array<{ keyword: string; count: number }>; unmatched: number } => {
  try {
    const parsed = JSON.parse(task?.skip_detail_json || task?.skipDetailJson || "{}");
    const excluded = Array.isArray(parsed?.excluded) ? parsed.excluded : [];
    const unmatched = Number(parsed?.unmatched || 0) || (!excluded.length ? Number(task?.skipped_rows ?? task?.skippedRows ?? 0) : 0);
    return { excluded, unmatched };
  } catch { return { excluded: [], unmatched: 0 }; }
};
const groupTransferFiles = (files: any[]) => {
  const groups = new Map<string, any[]>();
  files.forEach((file) => {
    const groupName = file.template_group_name || file.templateGroupName || (file.fileType === "target" ? "转送对象模板组" : "生成文件");
    const existing = groups.get(groupName) || [];
    existing.push(file);
    groups.set(groupName, existing);
  });
  return Array.from(groups.entries()).map(([name, groupFiles]) => ({ name, files: groupFiles }));
};

const taskArchiveName = (task: any) => {
  const files = Array.isArray(task?.files) ? task.files : [];
  const targetNames = [...new Set<string>(files.filter((file: any) => file.target_template_id).map((file: any) => file.template_item_name || file.template_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const otherNames = [...new Set(files.filter((file: any) => !file.target_template_id).map((file: any) => {
    const group = String(file.template_group_name || file.template_item_name || "转送文件");
    if (group.includes("导入格式")) return "导入格式";
    if (group.includes("收发委托")) return "收发委托单";
    return group.replace(/模板组?$/, "");
  }))];
  const suffix = (targetNames.length ? targetNames : otherNames).join("+") || "转送文件";
  return `${task.certificate_unit || "未命名"}_${String(task.calibration_date || "").replace(/-/g, "")}_${suffix}.zip`;
};

const monitorStatus = (status: string) => status === "ok"
  ? { color: "success", label: "正常" }
  : status === "warning"
    ? { color: "warning", label: "警告" }
    : { color: "error", label: "异常" };

const MonitorStatusTag = ({ status }: { status: string }) => {
  const meta = monitorStatus(status);
  return <Tag color={meta.color}>{meta.label}</Tag>;
};

const TransferMonitoringPanel = ({ monitoring, onRefresh, refreshing }: any) => {
  const summary = monitoring?.summary || { ok: 0, warning: 0, error: 0 };
  const issueText = (issues: string[]) => issues?.length ? issues.join("；") : "检查通过";
  return <div className="transfer-monitoring" aria-live="polite">
    <div className="transfer-monitoring-header">
      <div><h2>配置运行监控</h2><p>检查模板文件、表头、匹配列、关键字冲突及字段映射完整性</p></div>
      <Button icon={<ReloadOutlined spin={refreshing} />} loading={refreshing} onClick={() => void onRefresh()}>重新检查</Button>
    </div>
    <div className="transfer-monitoring-summary" role="status" aria-atomic="true">
      <Statistic title="正常" value={summary.ok} valueStyle={{ color: "#15803d" }} />
      <Statistic title="警告" value={summary.warning} valueStyle={{ color: "#b45309" }} />
      <Statistic title="异常" value={summary.error} valueStyle={{ color: "#b91c1c" }} />
      <span>检查时间：{monitoring?.checkedAt ? dayjs(monitoring.checkedAt).format("YYYY-MM-DD HH:mm:ss") : "尚未检查"}</span>
    </div>
    <section className="transfer-monitoring-section">
      <h3>模板项状态</h3>
      <Table size="small" rowKey="id" pagination={false} scroll={{ x: 720 }} dataSource={monitoring?.templates || []} columns={[
        { title: "模板组", dataIndex: "groupName", width: 160 },
        { title: "模板项", dataIndex: "itemName", width: 180 },
        { title: "状态", dataIndex: "status", width: 90, render: (status: string) => <MonitorStatusTag status={status} /> },
        { title: "检查结果", dataIndex: "issues", render: issueText },
      ]} />
    </section>
    <section className="transfer-monitoring-section">
      <h3>映射关系状态</h3>
      <Table size="small" rowKey="id" pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 900 }} dataSource={monitoring?.mappings || []} columns={[
        { title: "关系", dataIndex: "relation", width: 220 },
        { title: "源模板项", dataIndex: "sourceName", width: 160 },
        { title: "目标模板项", dataIndex: "targetName", width: 160 },
        { title: "映射数", dataIndex: "mappingCount", width: 80 },
        { title: "状态", dataIndex: "status", width: 90, render: (status: string) => <MonitorStatusTag status={status} /> },
        { title: "检查结果", dataIndex: "issues", render: issueText },
      ]} />
    </section>
  </div>;
};

const UnifiedMappingSettings = ({ config, reload }: any) => {
  const mappingConfig = {
    ...config,
    quoteTemplates: (config.quoteTemplates || []).map((item: any) => ({ ...item, name: templateLabel(item, "报价单模板") })),
    importTemplates: (config.importTemplates || []).map((item: any) => ({ ...item, name: templateLabel(item, "导入格式模板") })),
    uploadTemplates: (config.uploadTemplates || []).map((item: any) => ({ ...item, template_name: templateLabel(item, "收发委托单模板") })),
    orderTemplates: config.orderTemplates?.map((item: any) => ({ ...item, template_name: templateLabel(item, "收发委托单模板") })),
    targetTemplates: (config.targetTemplates || []).map((item: any) => ({ ...item, name: templateLabel(item, "转送对象模板") })),
  };
  return (
    <div className="unified-mapping-page">
      <ModernMappingSettings config={mappingConfig} reload={reload} />
    </div>
  );
};

const TemplateAccordion = ({ title, count, defaultOpen = false, children, onEdit, onDelete, onToggle }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLElement>(null);
  const handleEdit = () => {
    if (onEdit) return onEdit();
    rootRef.current?.querySelector<HTMLElement>(".ant-table-tbody tr")?.focus();
  };
  const handleDelete = () => {
    if (onDelete) return onDelete();
    rootRef.current?.querySelector<HTMLButtonElement>(".ant-table-tbody tr:first-child .ant-btn-danger")?.click();
  };
  return <section ref={rootRef} className={`template-accordion ${open ? "is-open" : "is-closed"}`}>
    <div className="template-accordion-header">
      <button type="button" className="template-accordion-trigger" onClick={() => setOpen((value: boolean) => !value)} aria-expanded={open}>
        <span className="template-accordion-chevron">{open ? "⌃" : "⌄"}</span><span className="template-accordion-title">{title}</span><span className="template-count">{count || 0} 个模板</span>
      </button>
      <div className="template-accordion-actions">
        <Button size="small" onClick={handleEdit}>编辑</Button>
        {onDelete && <Popconfirm title="确定删除当前模板吗？" okText="确定" cancelText="取消" onConfirm={handleDelete}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>}
        {onToggle && <><span className="template-enable-label">启用</span><Switch size="small" checked={onToggle.value} onChange={onToggle.onChange} /></>}
      </div>
    </div>
    {open && <div className="template-accordion-content">{children}</div>}
  </section>;
};

const TemplateSettingsManagerV2 = ({ config, reload }: any) => {
  const { message } = App.useApp();
  const [uploadForm] = Form.useForm();
  const [targetForm] = Form.useForm();
  const [uploadFile, setUploadFile] = useState<File>();
  const [targetFile, setTargetFile] = useState<File>();
  const [targetUploadKey, setTargetUploadKey] = useState(0);
  const [uploadHeaders, setUploadHeaders] = useState<string[]>([]);
  const [editingUpload, setEditingUpload] = useState<any>();
  const [editingTarget, setEditingTarget] = useState<any>();
  const readHeaders = async (file: File, headerRow = 1) => {
    const workbook = (await import("xlsx")).read(
      new Uint8Array(await file.arrayBuffer()),
      { type: "array" },
    );
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return (
      (await import("xlsx")).utils
        .sheet_to_json<any[]>(sheet, { header: 1, defval: "" })
        [Math.max(0, headerRow - 1)]?.map((value: any) => String(value).trim())
        .filter(Boolean) || []
    );
  };
  const chooseUploadFile = async (file: File) => {
    const snapshot = await snapshotUploadFile(file);
    setUploadFile(snapshot);
    const nextHeaders = await readHeaders(
      snapshot,
      Number(uploadForm.getFieldValue("headerRow") || 1),
    );
    setUploadHeaders(nextHeaders);
    message.success("Excel 文件上传成功");
    return false;
  };
  const saveUpload = async () => {
    if (uploadForm.getFieldValue("matchColumnEnabled") === false) uploadForm.setFieldsValue({ matchColumn: "disabled" });
    const values = await uploadForm.validateFields();
    if (!uploadFile && !editingUpload?.file_path) throw new Error("请先选择Excel文件");
    const matchColumnEnabled = values.matchColumnEnabled !== false;
    const matchColumn = values.matchColumn || editingUpload?.match_column;
    if (matchColumnEnabled && !matchColumn) throw new Error("请先选择Excel文件以读取匹配列");
    const data = new FormData();
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.order);
    Object.entries({ ...values, matchColumnEnabled, matchColumn: matchColumnEnabled ? matchColumn : "" }).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );
    if (editingUpload?.id) data.append("id", editingUpload.id);
    if (uploadFile) data.append("file", uploadFile);
    await apiClient.upload("/one-click-transfer/upload-templates", data);
    await reload();
    uploadForm.resetFields();
    setUploadFile(undefined);
    setUploadHeaders([]);
    setEditingUpload(undefined);
    message.success("模板保存完成");
  };
  const saveTarget = async () => {
    const values = await targetForm.validateFields();
    if (!targetFile && !editingTarget?.file_path) throw new Error("请先选择Excel文件");
    const data = new FormData();
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.target);
    Object.entries(values).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );
    if (editingTarget?.id) {
      data.append("id", editingTarget.id);
      data.append("filePath", editingTarget.file_path);
    }
    if (targetFile) data.append("file", targetFile);
    await apiClient.upload("/one-click-transfer/target-templates", data);
    await reload();
    targetForm.resetFields();
    setTargetFile(undefined);
    setTargetUploadKey((key) => key + 1);
    setEditingTarget(undefined);
    message.success("模板保存完成");
  };
  const editUpload = (row: any) => {
    setEditingUpload(row);
    setUploadHeaders(row.headers || []);
    uploadForm.setFieldsValue({
      templateItemName: row.template_item_name || row.template_name,
      headerRow: row.header_row,
      dataStartRow: row.data_start_row,
      matchColumn: row.match_column,
      matchColumnEnabled: row.match_column_enabled !== 0,
    });
  };
  const editTarget = (row: any) => {
    setEditingTarget(row);
    setTargetFile(undefined);
    setTargetUploadKey((key) => key + 1);
    targetForm.setFieldsValue({
      templateItemName: row.template_item_name || row.name,
      matchKeyword: row.match_keyword,
      headerRow: row.header_row,
      dataStartRow: row.data_start_row,
    });
  };
  const remove = async (kind: "upload" | "target", row: any) => {
    await apiClient.delete(
      `/one-click-transfer/${kind === "upload" ? "upload-templates" : "target-templates"}/${row.id}`,
    );
    await reload();
  };
  return (
    <div className="transfer-template-columns">
      <section className="transfer-template-column transfer-template-column-quote">
        <TemplateAccordion title="报价单模板" count={(config.quoteTemplates || []).length} defaultOpen onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-quote .ant-table-tbody tr")?.focus()}>
          <QuoteTemplateSettings config={config} reload={reload} />
        </TemplateAccordion>
      </section>
      <section className="transfer-template-column transfer-template-column-import">
        <TemplateAccordion title="导入格式模板" count={(config.importTemplates || []).length} onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-import .ant-table-tbody tr")?.focus()}>
          <ImportTemplateSettings config={config} reload={reload} />
        </TemplateAccordion>
      </section>
      <section className="transfer-template-column transfer-template-column-order">
        <TemplateAccordion title="收发委托模板" count={(config.uploadTemplates || []).length} onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-order .ant-table-tbody tr")?.focus()}>
        <Card title="收发委托单模板">
          <Form
            form={uploadForm}
            layout="vertical"
            className="transfer-template-form"
            onValuesChange={(changedValues, allValues) => {
              if (uploadFile && changedValues.headerRow !== undefined) {
                void readHeaders(uploadFile, Number(allValues.headerRow || 1)).then(setUploadHeaders);
              }
            }}
          >
            <Form.Item
              name="templateItemName"
              label="模板项名称"
              rules={[{ required: true, message: "请输入模板项名称" }]}
            >
              <Input placeholder="例如：收发委托单默认格式" />
            </Form.Item>
            <Form.Item name="headerRow" label="表头行号" initialValue={1}>
              <Input />
            </Form.Item>
            <Form.Item
              name="dataStartRow"
              label="数据起始行号"
              initialValue={2}
              rules={[{ required: true, message: "请输入数据起始行号" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="matchColumnEnabled" label="启用转送匹配列" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
            <Form.Item
              name="matchColumn"
              label="转送匹配列"
              rules={[{ required: true, message: "请选择匹配列" }]}
            >
              <Select
                placeholder={uploadHeaders.length ? "请选择转送匹配列" : "请先选择Excel文件"}
                options={uploadHeaders.map((header) => ({ label: header, value: header }))}
              />
            </Form.Item>
            <Upload
              fileList={uploadFile ? [{ uid: uploadFile.name, name: uploadFile.name, status: "done" as const }] : []}
              beforeUpload={chooseUploadFile}
              onRemove={() => { setUploadFile(undefined); setUploadHeaders(editingUpload?.headers || []); return true; }}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<PlusOutlined />}>选择Excel文件</Button>
            </Upload>
            <Space className="transfer-template-actions">
               <Button type="primary" onClick={() => void saveUpload().catch((error: any) => message.error(error?.message || "模板保存失败"))}>
                保存
              </Button>
              {editingUpload && (
                <Button
                  onClick={() => {
                    setEditingUpload(undefined);
                    setUploadHeaders([]);
                    uploadForm.resetFields();
                  }}
                >
                  取消
                </Button>
              )}
            </Space>
          </Form>
          <Table
            size="small"
            pagination={false}
            dataSource={config.uploadTemplates}
            rowKey="id"
            columns={[
              { title: "模板组名称", dataIndex: "template_group_name" },
              { title: "模板项名称", dataIndex: "template_item_name" },
              { title: "转送匹配列", dataIndex: "match_column" },
              { title: "文件", dataIndex: "file_name" },
              {
                title: "操作",
                render: (_: any, row: any) => (
                  <Space>
                    <Button type="link" onClick={() => editUpload(row)}>
                      修改
                    </Button>
                    <Popconfirm title="确定要删除这个模板吗？" okText="确定" cancelText="取消" onConfirm={() => void remove("upload", row).catch((error: any) => message.error(error?.message || "模板删除失败"))}>
                      <Button type="link" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
        </TemplateAccordion>
      </section>
      <section className="transfer-template-column transfer-template-column-target">
        <TemplateAccordion title="转送对象模板" count={(config.targetTemplates || []).length} onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-target .ant-table-tbody tr")?.focus()}>
        <Card title="转送对象模板">
          <Form form={targetForm} layout="vertical" className="transfer-template-form">
            <Form.Item
              name="templateItemName"
              label="模板项名称"
              rules={[{ required: true, message: "请输入模板项名称" }]}
            >
              <Input placeholder="例如：中溯检测格式" />
            </Form.Item>
            <Form.Item
              name="matchKeyword"
              label="匹配关键字"
              extra="支持说明型内容：B，校准点100，A，测100 会命中 B 或 A；仅按分隔片段完整匹配，不会把 AB 误判为 B"
              rules={[{ required: true }]}
            >
              <Input placeholder="多个关键字用中文或英文逗号分隔，例如：中溯，中溯检测" />
            </Form.Item>
            <Form.Item name="headerRow" label="表头行号" initialValue={1}>
              <Input />
            </Form.Item>
            <Form.Item
              name="dataStartRow"
              label="数据起始行号"
              initialValue={2}
            >
              <Input />
            </Form.Item>
            <Form.Item name="excludeKeyword" label="排除关键字" initialValue="A,华屹,A（不带标）" extra="这些值不会参与转送对象匹配，多个值用逗号分隔">
              <Input placeholder="例如：A，华屹，A（不带标）" />
            </Form.Item>
            <Upload
              key={targetUploadKey}
              beforeUpload={async (file) => {
                 setTargetFile(await snapshotUploadFile(file));
                 message.success("Excel 文件上传成功");
                return false;
              }}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<PlusOutlined />}>选择Excel文件</Button>
            </Upload>
            <div className="transfer-template-current-file">{editingTarget && !targetFile && editingTarget.file_name ? `当前文件：${editingTarget.file_name}` : ""}</div>
            <Space className="transfer-template-actions">
               <Button type="primary" onClick={() => void saveTarget().catch((error: any) => message.error(error?.message || "模板保存失败"))}>
                保存
              </Button>
              {editingTarget && (
                <Button
                  onClick={() => {
                    setEditingTarget(undefined);
                    setTargetFile(undefined);
                    setTargetUploadKey((key) => key + 1);
                    targetForm.resetFields();
                  }}
                >
                  取消
                </Button>
              )}
            </Space>
          </Form>
          <Table
            size="small"
            pagination={false}
            dataSource={config.targetTemplates}
            rowKey="id"
            columns={[
              { title: "模板组名称", dataIndex: "template_group_name" },
              { title: "模板项名称", dataIndex: "template_item_name" },
              { title: "关键字", dataIndex: "match_keyword" },
              {
                title: "操作",
                render: (_: any, row: any) => (
                  <Space>
                    <Button type="link" onClick={() => editTarget(row)}>
                      修改
                    </Button>
                    <Popconfirm title="确定要删除这个模板吗？" okText="确定" cancelText="取消" onConfirm={() => void remove("target", row).catch((error: any) => message.error(error?.message || "模板删除失败"))}>
                      <Button type="link" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
        </TemplateAccordion>
      </section>
    </div>
  );
};

const ModernMappingSettings = ({ config, reload }: any) => {
  const { message: appMessage } = App.useApp();
  const [targetGroup, setTargetGroup] = useState<string>();
  const [targetItemId, setTargetItemId] = useState<string>();
  const [sourceGroup, setSourceGroup] = useState<string>();
  const [sourceItemId, setSourceItemId] = useState<string>();
  const [mappings, setMappings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const suggestionVersion = useRef(0);
  const suggestionPrompted = useRef(new Set<string>());
  type TemplateKind = "quote" | "import" | "order" | "target";
  type TemplateCatalogItem = { kind: TemplateKind; group: string; item: any };
  const catalog: TemplateCatalogItem[] = [
    ...(config.quoteTemplates || []).map((item: any) => ({ kind: "quote" as const, group: templateGroupName(item, TEMPLATE_GROUP_NAMES.quote), item })),
    ...(config.importTemplates || []).map((item: any) => ({ kind: "import" as const, group: templateGroupName(item, TEMPLATE_GROUP_NAMES.import), item })),
    ...(config.uploadTemplates || []).map((item: any) => ({ kind: "order" as const, group: templateGroupName(item, TEMPLATE_GROUP_NAMES.order), item })),
    ...(config.targetTemplates || []).map((item: any) => ({ kind: "target" as const, group: templateGroupName(item, TEMPLATE_GROUP_NAMES.target), item })),
  ];
  const groupValue = (kind: TemplateKind, group: string) => `${kind}::${group}`;
  const groupKind = (value?: string) => value?.split("::", 1)[0] as TemplateKind | undefined;
  const groupLabel = (value?: string) => value?.slice((value.indexOf("::") + 2)) || "";
  const sourceType = groupKind(sourceGroup);
  const targetType = groupKind(targetGroup);
  const validTargetKinds: Record<Exclude<TemplateKind, "target">, TemplateKind[]> = {
    quote: ["import", "order", "target"],
    import: ["order", "target"],
    order: ["target"],
  };
  const sourceCatalog = catalog.filter((entry) => entry.kind !== "target");
  const targetCatalog = sourceType && sourceType !== "target"
    ? catalog.filter((entry) => validTargetKinds[sourceType].includes(entry.kind))
    : catalog.filter((entry) => entry.kind !== "quote");
  const uniqueGroupOptions = (entries: TemplateCatalogItem[]) => Array.from(
    new Map(entries.map((entry) => [groupValue(entry.kind, entry.group), { label: entry.group, value: groupValue(entry.kind, entry.group) }])).values(),
  );
  const sourceGroupOptions = uniqueGroupOptions(sourceCatalog);
  const targetGroupOptions = uniqueGroupOptions(targetCatalog);
  const sourceItemOptions = sourceCatalog
    .filter((entry) => sourceGroup === groupValue(entry.kind, entry.group))
    .map((entry) => ({ label: templateItemName(entry.item, templateLabel(entry.item)), value: entry.item.id }));
  const targetItemOptions = targetCatalog
    .filter((entry) => targetGroup === groupValue(entry.kind, entry.group))
    .map((entry) => ({ label: templateItemName(entry.item, templateLabel(entry.item)), value: entry.item.id }));
  const sourceTemplate = sourceCatalog.find((entry) => entry.kind === sourceType && entry.item.id === sourceItemId)?.item;
  const targetTemplate = targetCatalog.find((entry) => entry.kind === targetType && entry.item.id === targetItemId)?.item;
  const sourceOptions = (sourceTemplate?.headers || []).map((header: string) => ({ label: header, value: header }));
  const targetOptions = (targetTemplate?.headers || []).map((header: string) => ({ label: header, value: header }));
  const relation = sourceType && targetType ? `${sourceType}-${targetType}` : "";
  const previewRows = mappings.map((item) => ({
    source: item.sourceColumn || item.forcedKey || "",
    target: item.targetColumn || item.targetCell || "",
  })).filter((row) => {
    const matchesSearch = !previewSearch.trim() || `${row.source}${row.target}`.toLowerCase().includes(previewSearch.trim().toLowerCase());
    return matchesSearch && (!pendingOnly || !row.target);
  });
  const matchedCount = mappings.filter((item) => item.targetColumn || item.targetCell).length;
  const pendingCount = mappings.length - matchedCount;
  const markMappingsChanged = () => { suggestionVersion.current += 1; };
  const update = (index: number, changes: any) => { markMappingsChanged(); setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); };
  const appendMapping = (mapping: any) => { markMappingsChanged(); setMappings((current) => [...current, mapping]); };
  const removeMapping = (index: number) => { markMappingsChanged(); setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
  const requestSuggestedMappings = async () => {
    if (relation === "quote-import") return apiClient.get(`/one-click-transfer/quote-mappings/suggest?quoteTemplateId=${encodeURIComponent(sourceItemId!)}&importTemplateId=${encodeURIComponent(targetItemId!)}`);
    if (relation === "quote-order") return apiClient.get(`/one-click-transfer/quote-order-mappings/suggest?quoteTemplateId=${encodeURIComponent(sourceItemId!)}&orderTemplateId=${encodeURIComponent(targetItemId!)}`);
    if (relation === "import-order") return apiClient.get(`/one-click-transfer/import-mappings/suggest?importTemplateId=${encodeURIComponent(sourceItemId!)}&orderTemplateId=${encodeURIComponent(targetItemId!)}`);
    return apiClient.get(`/one-click-transfer/mappings/suggest?uploadTemplateId=${encodeURIComponent(sourceItemId!)}&targetTemplateId=${encodeURIComponent(targetItemId!)}`);
  };
  const suggestMappings = async () => {
    if (!sourceItemId || !targetItemId) {
      appMessage.warning("请先选择源模板项和目标模板项");
      return;
    }
    const requestVersion = ++suggestionVersion.current;
    try {
      const response: any = await requestSuggestedMappings();
      if (requestVersion === suggestionVersion.current && response.success) {
        const next = response.data || [];
        setMappings(next);
        appMessage.success(`已自动匹配 ${next.filter((item: any) => item.targetColumn || item.targetCell).length} 条映射，请确认后保存`);
      }
    } catch (error: any) {
      appMessage.error(error?.message || "自动匹配失败");
    }
  };
  useEffect(() => {
    if (!sourceItemId || !targetItemId) { setMappings([]); return; }
    const requestVersion = ++suggestionVersion.current;
    let current: any[] = [];
    if (relation === "quote-import") current = (config.quoteMappings || []).filter((item: any) => item.quote_template_id === sourceItemId && item.import_template_id === targetItemId);
    else if (relation === "quote-order") current = (config.quoteOrderMappings || []).filter((item: any) => item.quote_template_id === sourceItemId && item.order_template_id === targetItemId);
    else if (relation === "import-order") current = (config.importMappings || []).filter((item: any) => item.import_template_id === sourceItemId && item.order_template_id === targetItemId);
    else if (targetType === "target") {
      const allMappings = targetTemplate?.mappings || [];
      const specific = allMappings.filter((item: any) => item.upload_template_id === sourceItemId);
      const shared = allMappings.filter((item: any) => !item.upload_template_id && ["证书单位", "证书名称", "证书地址", "校准日期", "校准时间", "特殊要求"].includes(String(item.forcedKey || item.forced_key || "").trim()));
      const specificKeys = new Set(specific.map((item: any) => String(item.forcedKey || item.forced_key || "").trim()));
      current = specific.length ? [...specific, ...shared.filter((item: any) => !specificKeys.has(String(item.forcedKey || item.forced_key || "").trim()))] : allMappings.filter((item: any) => !item.upload_template_id);
    }
    if (current.length) { setMappings(current); return; }
    const promptKey = `${relation}:${sourceItemId}:${targetItemId}`;
    if (suggestionPrompted.current.has(promptKey)) { setMappings([]); return; }
    suggestionPrompted.current.add(promptKey);
    let cancelled = false;
    Modal.confirm({
      title: "自动匹配映射",
      content: "当前没有已保存的映射，是否根据字段名称自动匹配？",
      okText: "自动匹配",
      cancelText: "暂不匹配",
      onOk: async () => {
        try {
          const response: any = await requestSuggestedMappings();
          if (requestVersion === suggestionVersion.current && response.success) {
            const next = response.data || [];
            setMappings(next);
            appMessage.success(`已自动匹配 ${next.filter((item: any) => item.targetColumn || item.targetCell).length} 条映射，请确认后保存`);
          }
        } catch (error: any) {
          if (!cancelled) appMessage.error(error?.message || "自动匹配失败");
        }
      },
    });
    return () => { cancelled = true; };
  }, [sourceItemId, targetItemId, relation]);
  const save = async () => {
    if (!targetItemId || saving) return;
    setSaving(true);
    try {
      const payloadMappings = mappings.map((item) => ({ sourceColumn: item.sourceColumn || null, sourceColumn2: item.sourceColumn2 || null, targetColumn: item.targetColumn || null, forcedKey: item.forcedKey || null, targetCell: item.targetCell || null }));
      if (relation === "quote-import") await apiClient.post(`/one-click-transfer/quote-templates/${sourceItemId}/mappings`, { importTemplateId: targetItemId, mappings: payloadMappings });
      else if (relation === "quote-order") await apiClient.post(`/one-click-transfer/quote-templates/${sourceItemId}/order-mappings`, { orderTemplateId: targetItemId, mappings: payloadMappings });
      else if (relation === "import-order") await apiClient.post(`/one-click-transfer/import-templates/${sourceItemId}/mappings`, { orderTemplateId: targetItemId, mappings: payloadMappings });
      else await apiClient.post(`/one-click-transfer/target-templates/${targetItemId}/mappings`, { uploadTemplateId: sourceItemId, mappings: payloadMappings });
      await reload();
      appMessage.success("映射保存成功");
    } catch (error: any) {
      appMessage.error(error?.message || "映射保存失败");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mapping-design-page">
      <section className="mapping-target-panel">
        <div className="mapping-target-picker">
          <div className="mapping-section-title"><h2>目标类型</h2><p>选择源模板组到目标模板</p></div>
          <div className="mapping-template-selectors">
            <div><label>源模板组</label><Select allowClear showSearch optionFilterProp="label" placeholder="选择源模板组" options={sourceGroupOptions} value={sourceGroup} onChange={(value) => { setSourceGroup(value); setSourceItemId(undefined); setTargetGroup(undefined); setTargetItemId(undefined); setMappings([]); }} /></div>
            <div><label>源模板项</label><Select allowClear showSearch optionFilterProp="label" placeholder={sourceGroup ? "选择源模板项" : "先选择模板组"} disabled={!sourceGroup} options={sourceItemOptions} value={sourceItemId} onChange={(value) => { setSourceItemId(value); setMappings([]); }} /></div>
            <div><label>目标模板组</label><Select allowClear showSearch optionFilterProp="label" placeholder={sourceGroup ? "选择目标模板组" : "先选择源模板组"} disabled={!sourceGroup} options={targetGroupOptions} value={targetGroup} onChange={(value) => { setTargetGroup(value); setTargetItemId(undefined); setMappings([]); }} /></div>
            <div><label>目标模板项</label><Select allowClear showSearch optionFilterProp="label" placeholder={targetGroup ? "选择目标模板项" : "先选择模板组"} disabled={!targetGroup} options={targetItemOptions} value={targetItemId} onChange={(value) => { setTargetItemId(value); setMappings([]); }} /></div>
          </div>
        </div>
        <div className="mapping-direction-panel">
          <div className="mapping-direction-heading"><span className="mapping-direction-label">当前方向</span><Button className="mapping-auto-button" icon={<ReloadOutlined />} disabled={!sourceItemId || !targetItemId} onClick={() => void suggestMappings()}>自动匹配</Button></div>
          <div className="mapping-direction-box">
            <div className="mapping-direction-main"><strong>模板组 · 模板项</strong><ArrowRightOutlined /><strong>模板组 · 模板项</strong></div>
            <div className="mapping-direction-meta"><span>{groupLabel(sourceGroup) || "源模板组"} → {sourceItemOptions.find((item: any) => item.value === sourceItemId)?.label || "源模板项"}</span><span>字段级映射</span><a>来源：设置 → 模板配置</a></div>
          </div>
        </div>
      </section>

      <section className="mapping-workbench">
        <div className="mapping-workbench-header">
          <div>
            <h2>映射列表</h2>
            <p>点击选择框快速替换 · 状态实时校验</p>
          </div>
          <Space>
          <Dropdown
            menu={{
              items: ["证书单位", "证书地址", "校准日期", "特殊要求"].map((key) => ({ key, label: key })),
              onClick: ({ key }) => appendMapping({ forcedKey: key, targetMode: key === "校准日期" || key === "特殊要求" ? "header" : "cell" }),
            }}
          >
            <Button disabled={!targetTemplate}>＋ 特殊映射</Button>
          </Dropdown>
          <Button disabled={!targetTemplate || !sourceTemplate} onClick={() => appendMapping({ sourceColumn: "", targetColumn: "" })}>＋ 新增映射</Button>
          <Button type="primary" icon={<CheckOutlined />} loading={saving} disabled={!targetItemId} onClick={save}>保存映射</Button>
          </Space>
        </div>
      {targetTemplate ? <div className="mapping-workspace">
        <section className="mapping-editor">
          <div className="mapping-context-bar">
            <div><span>源模板组</span><strong>{groupLabel(sourceGroup) || "-"}</strong></div>
            <div><span>源模板项</span><strong>{sourceItemOptions.find((item: any) => item.value === sourceItemId)?.label || "-"}</strong></div>
            <div><span>目标模板组</span><strong>{groupLabel(targetGroup) || "-"}</strong></div>
            <div><span>目标模板项</span><strong>{targetItemOptions.find((item: any) => item.value === targetItemId)?.label || "-"}</strong></div>
            <div><a>设置 → 模板配置</a><span>先选组，再加载模板项</span></div>
          </div>
          <div className="mapping-column-head"><span>序号</span><span>源模板项</span><span>映射</span><span>目标模板项</span><span>状态</span><span>操作</span></div>
          <div className="mapping-rows">
            {mappings.length === 0 && <div className="mapping-empty">暂无映射，点击“新增映射”开始配置。</div>}
            {mappings.map((item, index) => {
              const special = Boolean(item.forcedKey);
              const isCell = item.targetMode === "cell" || (!item.targetMode && item.targetCell);
              const complete = Boolean(item.targetColumn || item.targetCell);
              return <div className={`mapping-item ${special ? "mapping-item-special" : ""}`} key={`${index}-${item.forcedKey || item.sourceColumn || "new"}`}>
                <span className="mapping-item-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="mapping-field">{special ? <Input disabled value={item.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={item.sourceColumn || undefined} onChange={(value) => update(index, { sourceColumn: value })} />}</div>
                <div className="mapping-line"><ArrowRightOutlined /></div>
                <div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期', '特殊要求', '证书单位', '证书地址'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div>
                <span className={`mapping-item-status ${complete ? "is-complete" : "is-pending"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span>
                <Button type="text" danger aria-label="删除映射" onClick={() => removeMapping(index)}>删除</Button>
              </div>;
            })}
          </div>
        </section>
        <aside className="mapping-preview"><h3>映射预览</h3><p className="mapping-preview-caption">A 列：源字段　 B 列：目标字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{previewRows.map((row, index) => <div key={`${row.source}-${row.target}-${index}`}><span>{index + 1}</span><span>{row.source}</span><span className={!row.target ? "is-pending-cell" : ""}>{row.target || "待配置"}</span></div>)}</div></div><h3 className="mapping-tools-title">实用工具</h3><div className="mapping-preview-tools"><Input prefix={<SearchOutlined />} allowClear placeholder="搜索字段" value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} /><div className="mapping-pending-toggle"><Checkbox checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)}>仅显示待配置</Checkbox><span>{pendingCount} 项</span></div><Space.Compact block><Button icon={<CopyOutlined />} onClick={() => { void navigator.clipboard?.writeText(mappings.map((item) => `${item.sourceColumn || ""} → ${item.targetColumn || item.targetCell || ""}`).join("\n")); appMessage.success("映射已复制"); }}>复制映射</Button><Button icon={<DownloadOutlined />} onClick={() => { const content = ["源字段,目标字段", ...mappings.map((item) => `${item.sourceColumn || ""},${item.targetColumn || item.targetCell || ""}`)].join("\n"); downloadBlob(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }), "mapping-preview.csv"); }}>导出预览</Button></Space.Compact><Button block type="dashed" icon={<CheckCircleOutlined />} onClick={() => appMessage.success(`校验完成：${matchedCount} 条映射已配置`)}>快速校验全部映射</Button></div></aside>
      </div> : <div className="mapping-guide">先选择源模板和目标模板，随后即可配置字段映射。</div>}
      </section>
    </div>
  );
};

export default OneClickTransferPage;
