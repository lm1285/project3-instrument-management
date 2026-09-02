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

type Target = {
  id: string;
  name: string;
  template_group_name?: string;
  template_item_name?: string;
  match_keyword: string;
  header_row: number;
  data_start_row: number;
  headers?: string[];
  mappings?: any[];
  file_name?: string;
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
const templateGroupOptions = (items: any[], fallback: string) =>
  Array.from(new Set(items.map((item) => templateGroupName(item, fallback)))).map((value) => ({ label: value, value }));
const TEMPLATE_GROUP_NAMES = {
  quote: "报价单模板组",
  import: "导入格式模板组",
  order: "收发委托模板组",
  target: "转送对象模板组",
} as const;

const emptyConfig = { uploadTemplates: [], orderTemplates: [], importTemplates: [], quoteTemplates: [], importMappings: [], quoteMappings: [], quoteOrderMappings: [], targetTemplates: [], settings: {} };
const EXCEL_FILE_ACCEPT = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
const taskPreviewColumns = ["仪器名称", "型号规格", "制造厂", "出厂编号", "管理编号", "测量范围"];
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
  const [headers, setHeaders] = useState<string[]>([]);
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
    setHeaders(detectedHeaders);
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
      const snapshot = await snapshotUploadFile(file);
      setSourceFile({
        uid: `source-${snapshot.lastModified}`,
        name: snapshot.name,
        size: snapshot.size,
        type: snapshot.type,
        status: "done",
        originFileObj: snapshot,
      });
      await parseHeaders(snapshot);
    } catch (error: any) {
      setSourceFile(null);
      setHeaders([]);
      appMessage.error(error?.message || "读取Excel文件失败");
    }

    return false;
  };
  const removeSourceFile = () => {
    setSourceFile(null);
    setHeaders([]);
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
      if (selectedSourceType === "quote" && (values.generationMode === "order" || values.generationMode === "all") && !selectedOrderTemplateId) return appMessage.error("请先选择收发委托单模板");
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
      );
      if (!response.success) throw new Error(response.message);
      appMessage.success("处理完成");
      setModalOpen(false);
      setActiveTab("completed");
      await load();
      setSelectedTask(response.data?.task);
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
          setHeaders([]);
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
    <div className="transfer-completed">
      <Row className="transfer-completed-summary" gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="已完成任务" value={completedTasks.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="累计生成文件"
              value={completedTasks.reduce(
                (sum, task) => sum + (task.files?.length || 0),
                0,
              )}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="累计跳过行"
              value={completedTasks.reduce(
                (sum, task) => sum + (task.skipped_rows || 0),
                0,
              )}
            />
          </Card>
        </Col>
      </Row>
      {completedTasks.map((task) => (
        <Card
          key={task.id}
          className="task-card"
          title={`${task.folder_name} · ${task.source_filename}`}
          extra={(() => {
            const taskFiles = Array.isArray(task.files) ? task.files : [];
            const importFile = taskFiles.find((file: any) => file.match_keyword === "导入格式");
            const orderFile = taskFiles.find((file: any) => file.match_keyword === "收发委托单");
            return (
            <Space wrap className="task-card-actions">
              <Button
                icon={<DownloadOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  void download(
                    `/one-click-transfer/tasks/${task.id}/download`,
                    `${task.folder_name}.zip`,
                  );
                }}
              >
                下载文件夹
              </Button>
              {importFile && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    void download(
                      `/one-click-transfer/files/${importFile.id}/download`,
                      importFile.filename || "导入格式.xlsx",
                    );
                  }}
                >
                  下载导入格式
                </Button>
              )}
              {orderFile && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    void download(
                      `/one-click-transfer/files/${orderFile.id}/download`,
                      orderFile.filename || "收发委托单.xlsx",
                    );
                  }}
                >
                  下载收发委托单
                </Button>
              )}
              <Popconfirm
                title="确认删除此任务？"
                onConfirm={() => deleteTask(task)}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => event.stopPropagation()}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
            );
          })()}
          onClick={() => {
            setSelectedTask(task);
            setSelectedCategory(task.files?.[0]?.match_keyword || "");
          }}
        >
          <Space wrap>
            {(task.files || []).map((file: any) => (
              <Tag key={file.id}>
                {file.match_keyword} · {file.row_count} 行
              </Tag>
            ))}
          </Space>
          {selectedTask?.id === task.id && (
            <div
              className="category-area"
              onClick={(event) => event.stopPropagation()}
            >
              <Segmented
                className="transfer-category-selector"
                options={task.files.map((file: any) => file.match_keyword)}
                value={selectedCategory}
                onChange={(value) => setSelectedCategory(String(value))}
                block
              />
              <Space className="category-download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    download(
                      `/one-click-transfer/tasks/${task.id}/categories/${encodeURIComponent(selectedCategory)}/download`,
                      // A category currently produces one Excel file. Reuse the
                      // generated filename so the Blob is not mislabeled as a ZIP.
                      task.files.find(
                        (file: any) => file.match_keyword === selectedCategory,
                      )?.filename || `${selectedCategory}.xlsx`,
                    )
                  }
                >
                  下载该分类文件
                </Button>
              </Space>
              <Table
                className="transfer-preview-table"
                size="small"
                rowKey={(_, index) => `${selectedCategory}-${index}`}
                pagination={false}
                scroll={{ x: 900 }}
                dataSource={getPreviewRows(task.files.find(
                  (file: any) => file.match_keyword === selectedCategory,
                ))}
                columns={taskPreviewColumns.map((title) => ({
                  title,
                  dataIndex: title,
                  key: title,
                  align: "center" as const,
                  ellipsis: true,
                }))}
              />
            </div>
          )}
        </Card>
      ))}
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
              <Button
                type="primary"
                onClick={async () => {
                  try {
                    const values = await form.validateFields([
                      "certificateUnit",
                      "certificateAddress",
                      "calibrationDate",
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
                <Radio.Group value={sourceType} onChange={(event) => { const value = event.target.value; setSourceType(value); setHeaders([]); setSourceFile(null); const defaultMode = value === "quote" ? "all" : "target"; setGenerationMode(defaultMode); form.setFieldsValue({ sourceType: value, generationMode: defaultMode }); }} options={[{ label: "报价单", value: "quote" }, { label: "导入格式", value: "import" }, { label: "收发委托单", value: "order" }]} />
              </Form.Item>
              {sourceType === "quote" && <Form.Item name="quoteTemplateId" label="报价单模板项" rules={[{ required: true, message: "请选择报价单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择报价单模板项" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: templateLabel(item, "报价单模板"), value: item.id }))} onChange={(value) => { setQuoteTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "import" && <Form.Item name="importTemplateId" label="导入格式模板项" rules={[{ required: true, message: "请选择导入格式模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板项" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: templateLabel(item, "导入格式模板"), value: item.id }))} onChange={(value) => { setImportTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "order" && <Form.Item name="orderTemplateId" label="收发委托单模板项" rules={[{ required: true, message: "请选择收发委托单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板项" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: templateLabel(item, "收发委托模板"), value: item.id }))} onChange={(value) => { setOrderTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "quote" && generationMode === "import" && <Form.Item name="importTemplateId" label="生成所用导入格式模板项" rules={[{ required: true, message: "请选择导入格式模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板项" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: templateLabel(item, "导入格式模板"), value: item.id }))} onChange={setImportTemplateId} /></Form.Item>}
              {sourceType === "quote" && (generationMode === "order" || generationMode === "all") && <Form.Item name="orderTemplateId" label="生成所用收发委托单模板项" rules={[{ required: true, message: "请选择收发委托单模板项" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板项" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: templateLabel(item, "收发委托模板"), value: item.id }))} onChange={setOrderTemplateId} /></Form.Item>}
              <Form.Item name="generationMode" label="生成内容" initialValue={sourceType === "quote" ? "all" : "target"}>
                <Radio.Group value={generationMode} onChange={(event) => { const value = event.target.value; setGenerationMode(value); form.setFieldsValue({ generationMode: value }); if (value === "import") { setOrderTemplateId(undefined); form.setFieldsValue({ orderTemplateId: undefined }); } }} options={sourceType === "quote" ? [{ label: "生成导入格式", value: "import" }, { label: "生成收发委托单", value: "order" }, { label: "生成收发委托单和转送表", value: "all" }] : [{ label: "生成转送表", value: "target" }]} />
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
const LegacyTemplateSettings = ({ config, reload }: any) => {
  const [uploadForm] = Form.useForm();
  const [targetForm] = Form.useForm();
  const [uploadFile, setUploadFile] = useState<File>();
  const [targetFile, setTargetFile] = useState<File>();
  const saveUpload = async () => {
    const values = await uploadForm.validateFields();
    if (!uploadFile) throw new Error("请上传待上传模板Excel文件");
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );
    data.append("file", uploadFile);
    await apiClient.upload("/one-click-transfer/upload-templates", data);
    await reload();
    uploadForm.resetFields();
    setUploadFile(undefined);
  };
  const saveTarget = async () => {
    const values = await targetForm.validateFields();
    if (!targetFile) throw new Error("请选择转送对象模板文件");
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );
    data.append("file", targetFile);
    await apiClient.upload("/one-click-transfer/target-templates", data);
    await reload();
    targetForm.resetFields();
    setTargetFile(undefined);
  };
  return (
    <Row gutter={16}>
      <Col span={10}>
        <Card title="待上传模板">
          <Form form={uploadForm} layout="vertical">
            <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true }]}><Input placeholder="请输入模板项名称" /></Form.Item>
            <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true }]}><Input placeholder="请输入模板项名称" /></Form.Item>
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
            <Form.Item name="matchColumn" label="转送匹配列" rules={[{ required: true, message: "请选择匹配列" }]}>
              <Select placeholder={uploadHeaders.length ? "请选择转送匹配列" : "请先选择Excel文件"} options={uploadHeaders.map((header) => ({ label: header, value: header }))} />
            </Form.Item>
            <Form.Item name="matchColumn" label="匹配列" rules={[{ required: true, message: "请选择匹配列" }]}>
              <Select placeholder={uploadHeaders.length ? "请选择匹配列" : "请先选择Excel文件"} options={uploadHeaders.map((header) => ({ label: header, value: header }))} />
            </Form.Item>
            <Upload
              beforeUpload={(f) => {
                setUploadFile(f);
                return false;
              }}
              maxCount={1}
              accept=".xlsx"
            >
              <Button icon={<PlusOutlined />}>选择待上传模板文件</Button>
            </Upload>
            <Button
              type="primary"
              onClick={saveUpload}
              style={{ marginTop: 12 }}
            >
              保存
            </Button>
          </Form>
          <div className="mapping-toolbar">
            <strong>字段映射</strong>
            <Space size={12}>
              <span>已匹配 {mappings.filter((item) => item.sourceColumn && item.targetColumn).length} 项 · 待配置 {mappings.filter((item) => !item.targetColumn && !item.targetCell).length} 项</span>
              <Select
                className="mapping-special-add"
                placeholder="新增特殊映射"
                value={undefined}
                options={["证书单位", "证书地址", "校准日期"].map((item) => ({ label: item, value: item }))}
                onChange={(forcedKey) =>
                  setMappings((current) => [
                    ...current,
                    { forcedKey, sourceColumn: "", targetColumn: "", targetMode: forcedKey === "校准日期" ? "header" : "cell" },
                  ])
                }
              />
            </Space>
          </div>
          <div className="mapping-list">
            {mappings.map((row: any, index: number) => {
              const special = Boolean(row.forcedKey);
              const complete = Boolean(row.targetColumn || row.targetCell);
              return (
                <div className={`mapping-row ${special ? "mapping-row-special" : ""}`} key={`${index}-${row.forcedKey || row.sourceColumn || "new"}`}>
                  <span className="mapping-index">{String(index + 1).padStart(2, "0")}</span>
                  {special ? <Input disabled value={row.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={row.sourceColumn || undefined} onChange={(value) => updateMapping(index, { sourceColumn: value })} />}
                  <ArrowRightOutlined className="mapping-arrow" />
                  {special ? <Space.Compact block><Select style={{ width: 118 }} value={row.targetMode || (row.targetCell ? "cell" : "header")} options={[{ label: "目标列", value: "header" }, { label: "固定单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(row.forcedKey)} onChange={(value) => updateMapping(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{(row.targetMode || (row.targetCell ? "cell" : "header")) === "cell" ? <Input placeholder="例如 B2" value={row.targetCell} onChange={(event) => updateMapping(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标列" options={targetOptions} value={row.targetColumn || row.forcedKey || undefined} onChange={(value) => updateMapping(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={row.targetColumn || undefined} onChange={(value) => updateMapping(index, { targetColumn: value })} />}
                  <span className={`mapping-status ${complete ? "mapping-status-success" : "mapping-status-warning"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span>
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => setMappings((current) => current.filter((_, rowIndex) => rowIndex !== index))} />
                </div>
              );
            })}
          </div>
          <Table
            className="mapping-legacy-table"
            size="small"
            pagination={false}
            dataSource={config.uploadTemplates}
            rowKey="id"
            columns={[
              { title: "模板组名称", dataIndex: "template_group_name" },
              { title: "模板项名称", dataIndex: "template_item_name" },
              { title: "文件", dataIndex: "file_name" },
              { title: "表头", dataIndex: "header_row" },
              { title: "起始", dataIndex: "data_start_row" },
            ]}
          />
        </Card>
      </Col>
      <Col span={14}>
        <Card title="转送对象模板">
          <Form form={targetForm} layout="vertical">
            <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true }]}><Input placeholder="例如：中溯检测格式" /></Form.Item>
            <Form.Item
              name="matchKeyword"
              label="匹配关键字"
              extra="多个关键字请用中文或英文逗号分隔，例如：中溯，中溯检测"
              rules={[
                { required: true, message: "请填写至少一个匹配关键字" },
                {
                  validator: (_, value) => String(value || "").split(/[,，]/).some((item) => item.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error("请填写至少一个匹配关键字")),
                },
              ]}
            >
              <Input placeholder="例如：中溯，中溯检测" />
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
            <Upload
              beforeUpload={async (f) => {
                setTargetFile(await snapshotUploadFile(f));
                return false;
              }}
              maxCount={1}
              accept=".xlsx"
            >
              <Button icon={<PlusOutlined />}>选择模板文件</Button>
            </Upload>
            <Button
              type="primary"
              onClick={saveTarget}
              style={{ marginTop: 12 }}
            >
              保存模板
            </Button>
          </Form>
          <Table
            size="small"
            pagination={false}
            dataSource={config.targetTemplates}
            rowKey="id"
            columns={[
              { title: "模板", dataIndex: "name" },
              { title: "关键字", dataIndex: "match_keyword" },
              { title: "文件", dataIndex: "file_path" },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
};
void LegacyTemplateSettings;
const LegacyTemplateSettingsManager = ({ config, reload }: any) => {
  const [uploadForm] = Form.useForm();
  const [targetForm] = Form.useForm();
  const [uploadFile, setUploadFile] = useState<File>();
  const [targetFile, setTargetFile] = useState<File>();
  const [editingUpload, setEditingUpload] = useState<any>();
  const [editingTarget, setEditingTarget] = useState<any>();
  const saveUpload = async () => {
    const values = await uploadForm.validateFields();
    if (!uploadFile && !editingUpload?.file_path) throw new Error("请先选择Excel文件");
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      data.append(key, String(value ?? "")),
    );
    if (editingUpload?.id) data.append("id", editingUpload.id);
    if (uploadFile) data.append("file", uploadFile);
    await apiClient.upload("/one-click-transfer/upload-templates", data);
    await reload();
    uploadForm.resetFields();
    setUploadFile(undefined);
    setEditingUpload(undefined);
  };
  const saveTarget = async () => {
    const values = await targetForm.validateFields();
    if (!targetFile && !editingTarget?.file_path) throw new Error("请先选择Excel文件");
    const data = new FormData();
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
    setEditingTarget(undefined);
  };
  const editUpload = (row: any) => {
    setEditingUpload(row);
    uploadForm.setFieldsValue({
      templateItemName: row.template_item_name || row.template_name,
      headerRow: row.header_row,
      dataStartRow: row.data_start_row,
    });
  };
  const editTarget = (row: any) => {
    setEditingTarget(row);
    setTargetFile(undefined);
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
    <Row gutter={16}>
      <Col span={10}>
        <Card title="待上传模板">
          <Form form={uploadForm} layout="vertical">
            <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true }]}><Input placeholder="例如：收发委托单" /></Form.Item>
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
            <Upload
              beforeUpload={(f) => {
                setUploadFile(f);
                return false;
              }}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<PlusOutlined />}>选择Excel文件</Button>
            </Upload>
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={saveUpload}>
                {editingUpload ? "更新" : "保存"}
              </Button>
              {editingUpload && (
                <Button
                  onClick={() => {
                    setEditingUpload(undefined);
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
              { title: "文件", dataIndex: "file_name" },
              {
                title: "操作",
                render: (_: any, row: any) => (
                  <Space>
                    <Button type="link" onClick={() => editUpload(row)}>
                      修改
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() => remove("upload", row)}
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>
      <Col span={14}>
        <Card title="转送对象模板">
          <Form form={targetForm} layout="vertical">
            <Form.Item name="templateItemName" label="模板项名称" rules={[{ required: true }]}><Input placeholder="例如：中溯检测格式" /></Form.Item>
            <Form.Item
              name="matchKeyword"
              label="匹配关键字"
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
            <Upload
              beforeUpload={async (f) => {
                setTargetFile(await snapshotUploadFile(f));
                return false;
              }}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<PlusOutlined />}>选择Excel文件</Button>
            </Upload>
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={saveTarget}>
                {editingTarget ? "更新" : "保存模板"}
              </Button>
              {editingTarget && (
                <Button
                  onClick={() => {
                    setEditingTarget(undefined);
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
              { title: "模板", dataIndex: "name" },
              { title: "关键字", dataIndex: "match_keyword" },
              {
                title: "操作",
                render: (_: any, row: any) => (
                  <Space>
                    <Button type="link" onClick={() => editTarget(row)}>
                      修改
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() => remove("target", row)}
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
};

void LegacyTemplateSettingsManager;
const QuoteTemplateSettings = ({ config, reload }: any) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [file, setFile] = useState<File>();
  const [editing, setEditing] = useState<any>();
  const save = async () => {
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择报价单模板文件");
    const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.quote);
    if (editing?.id) data.append("id", editing.id); if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/quote-templates", data); await reload();
    form.resetFields(); setFile(undefined); setEditing(undefined);
    message.success("模板保存完成");
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
       <Space className="transfer-template-actions"><Button type="primary" onClick={() => void save().catch((error: any) => message.error(error?.message || "模板保存失败"))}>保存</Button>{editing && <Button onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
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
  const readHeaders = async (next: File, headerRow = 1) => {
    const workbook = (await import("xlsx")).read(new Uint8Array(await next.arrayBuffer()), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return (await import("xlsx")).utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })[Math.max(0, headerRow - 1)]?.map((value: any) => String(value).trim()).filter(Boolean) || [];
  };
  const save = async () => {
    if (form.getFieldValue("matchColumnEnabled") === false) form.setFieldsValue({ matchColumn: "disabled" });
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择导入格式文件");
    const data = new FormData();
    data.set("templateGroupName", TEMPLATE_GROUP_NAMES.import);
    Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    if (editing?.id) data.append("id", editing.id);
    if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/import-templates", data);
    await reload();
    form.resetFields(); setFile(undefined); setHeaders([]); setEditing(undefined);
    message.success("模板保存完成");
  };
  const edit = (row: any) => { setEditing(row); setHeaders(row.headers || []); form.setFieldsValue({ templateItemName: row.template_item_name || row.name, headerRow: row.header_row, dataStartRow: row.data_start_row, matchColumn: row.match_column, matchColumnEnabled: row.match_column_enabled !== 0 }); };
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
          beforeUpload={async (next) => { const snapshot = await snapshotUploadFile(next); setFile(snapshot); setHeaders(await readHeaders(snapshot, Number(form.getFieldValue("headerRow") || 1))); message.success("Excel 文件上传成功"); return false; }}
         onRemove={() => { setFile(undefined); setHeaders(editing?.headers || []); return true; }}
         maxCount={1}
         accept=".xlsx,.xls"
       >
         <Button icon={<PlusOutlined />}>选择导入格式文件</Button>
       </Upload>
       <div className="transfer-template-current-file">{editing && !file ? `当前文件：${editing.file_name}` : ""}</div>
       <Space className="transfer-template-actions"><Button type="primary" onClick={() => void save().catch((error: any) => message.error(error?.message || "模板保存失败"))}>保存</Button>{editing && <Button onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
    </Form>
    <Table size="small" pagination={false} rowKey="id" dataSource={config.importTemplates || []} columns={[
      { title: "模板组名称", dataIndex: "template_group_name" }, { title: "模板项名称", dataIndex: "template_item_name" }, { title: "表头行", dataIndex: "header_row" }, { title: "数据起始行", dataIndex: "data_start_row" }, { title: "文件", dataIndex: "file_name" },
      { title: "操作", render: (_: any, row: any) => <Space><Button type="link" onClick={() => edit(row)}>修改</Button><Popconfirm title="确定要删除这个模板吗？" okText="确定" cancelText="取消" onConfirm={() => void remove(row).catch((error: any) => message.error(error?.message || "模板删除失败"))}><Button type="link" danger>删除</Button></Popconfirm></Space> },
    ]} />
  </Card>;
};

const QuoteImportMappingSettings = ({ config, reload }: any) => {
  const { message: appMessage } = App.useApp();
  const [quoteId, setQuoteId] = useState<string>(); const [importId, setImportId] = useState<string>(); const [mappings, setMappings] = useState<any[]>([]); const [saving, setSaving] = useState(false);
  const suggestionVersion = useRef(0);
  const suggestionPrompted = useRef(new Set<string>());
  const quote = (config.quoteTemplates || []).find((item: QuoteTemplate) => item.id === quoteId); const importTemplate = (config.importTemplates || []).find((item: ImportTemplate) => item.id === importId);
  useEffect(() => {
    if (!quoteId || !importId) { setMappings([]); return; }
    const requestVersion = ++suggestionVersion.current;
    const current = (config.quoteMappings || []).filter((item: any) => item.quote_template_id === quoteId && item.import_template_id === importId);
    if (current.length) { setMappings(current); return; }
    const promptKey = `${quoteId}:${importId}`;
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
          const response: any = await apiClient.get(`/one-click-transfer/quote-mappings/suggest?quoteTemplateId=${encodeURIComponent(quoteId)}&importTemplateId=${encodeURIComponent(importId)}`);
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
  }, [quoteId, importId]);
  const markMappingsChanged = () => { suggestionVersion.current += 1; };
  const update = (index: number, changes: any) => { markMappingsChanged(); setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); };
  const appendMapping = (mapping: any) => { markMappingsChanged(); setMappings((current) => [...current, mapping]); };
  const removeMapping = (index: number) => { markMappingsChanged(); setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
  const save = async () => { if (!quoteId || !importId || saving) return; setSaving(true); try { await apiClient.post(`/one-click-transfer/quote-templates/${quoteId}/mappings`, { importTemplateId: importId, mappings: mappings.map((item) => ({ sourceColumn: item.sourceColumn || null, targetColumn: item.targetColumn || null, forcedKey: item.forcedKey || null, targetCell: item.targetCell || null })) }); await reload(); appMessage.success("报价单映射保存成功"); } catch (error: any) { appMessage.error(error?.message || "报价单映射保存失败"); } finally { setSaving(false); } };
  const sourceOptions = (quote?.headers || []).map((value: string) => ({ label: value, value })); const targetOptions = (importTemplate?.headers || []).map((value: string) => ({ label: value, value }));
  return <div className="mapping-workbench"><div className="mapping-workbench-header"><div><h2>报价单 → 导入格式</h2><p>报价单是后续生成导入格式和收发委托单的基础</p></div><Space><Dropdown menu={{ items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })), onClick: ({ key }) => appendMapping({ forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }) }}><Button icon={<PlusOutlined />} disabled={!importTemplate}>新增特殊映射</Button></Dropdown><Button icon={<PlusOutlined />} disabled={!quote || !importTemplate} onClick={() => appendMapping({ sourceColumn: "", targetColumn: "" })}>新增映射</Button><Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={!quoteId || !importId} onClick={save}>保存映射</Button></Space></div><div className="mapping-template-bar"><div><label>报价单模板项</label><Select showSearch optionFilterProp="label" placeholder="选择报价单模板项" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: templateLabel(item, "报价单模板"), value: item.id }))} value={quoteId} onChange={setQuoteId} /></div><div><label>导入格式模板项</label><Select showSearch optionFilterProp="label" placeholder="选择导入格式模板项" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: templateLabel(item, "导入格式模板"), value: item.id }))} value={importId} onChange={setImportId} /></div><div className="mapping-progress"><span>映射完成度 <b>{mappings.filter((item) => item.targetColumn || item.targetCell).length} / {mappings.length}</b></span><div><i style={{ width: mappings.length ? `${mappings.filter((item) => item.targetColumn || item.targetCell).length / mappings.length * 100}%` : "0%" }} /></div></div></div>{quote && importTemplate ? <div className="mapping-workspace"><section className="mapping-editor"><div className="mapping-editor-title"><strong>字段映射</strong><span>报价单字段 → 导入格式字段</span></div><div className="mapping-rows">{mappings.map((item, index) => { const special = Boolean(item.forcedKey); const isCell = item.targetMode === "cell" || (!item.targetMode && item.targetCell); const complete = Boolean(item.targetColumn || item.targetCell); return <div className={`mapping-item ${special ? "mapping-item-special" : ""}`} key={`${index}-${item.forcedKey || item.sourceColumn || "new"}`}><span className="mapping-item-index">{String(index + 1).padStart(2, "0")}</span><div className="mapping-field">{special ? <Input disabled value={item.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={item.sourceColumn || undefined} onChange={(value) => update(index, { sourceColumn: value })} />}</div><div className="mapping-line"><ArrowRightOutlined /></div><div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div><span className={`mapping-item-status ${complete ? "is-complete" : "is-pending"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => removeMapping(index)} /></div>; })}</div></section><aside className="mapping-preview"><h3>字段预览</h3><p className="mapping-preview-caption">A 列：报价单字段　B 列：导入格式字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{Array.from({ length: Math.max(sourceOptions.length, targetOptions.length) }, (_, index) => <div key={index}><span>{index + 1}</span><span>{sourceOptions[index]?.value || ""}</span><span>{targetOptions[index]?.value || ""}</span></div>)}</div></div></aside></div> : <div className="mapping-guide">请先选择报价单和导入格式模板项</div>}</div>;
};

const QuoteOrderMappingSettings = ({ config, reload }: any) => {
  const { message: appMessage } = App.useApp();
  const [quoteId, setQuoteId] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [mappings, setMappings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const suggestionVersion = useRef(0);
  const suggestionPrompted = useRef(new Set<string>());
  const quote = (config.quoteTemplates || []).find((item: QuoteTemplate) => item.id === quoteId);
  const orderTemplate = (config.orderTemplates || config.uploadTemplates || []).find((item: UploadTemplate) => item.id === orderId);
  useEffect(() => {
    if (!quoteId || !orderId) { setMappings([]); return; }
    const requestVersion = ++suggestionVersion.current;
    const current = (config.quoteOrderMappings || []).filter((item: any) => item.quote_template_id === quoteId && item.order_template_id === orderId);
    if (current.length) { setMappings(current); return; }
    const promptKey = `${quoteId}:${orderId}`;
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
          const response: any = await apiClient.get(`/one-click-transfer/quote-order-mappings/suggest?quoteTemplateId=${encodeURIComponent(quoteId)}&orderTemplateId=${encodeURIComponent(orderId)}`);
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
  }, [quoteId, orderId]);
  const markMappingsChanged = () => { suggestionVersion.current += 1; };
  const update = (index: number, changes: any) => { markMappingsChanged(); setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); };
  const removeMapping = (index: number) => { markMappingsChanged(); setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
    const sourceOptions = (quote?.headers || []).map((value: string) => ({ label: value, value }));
  const targetOptions = (orderTemplate?.headers || []).map((value: string) => ({ label: value, value }));
  const save = async () => {
    if (!quoteId || !orderId || saving) return;
    setSaving(true);
    try {
      await apiClient.post(`/one-click-transfer/quote-templates/${quoteId}/order-mappings`, { orderTemplateId: orderId, mappings: mappings.map((item) => ({ sourceColumn: item.sourceColumn || null, targetColumn: item.targetColumn || null, forcedKey: item.forcedKey || null, targetCell: item.targetCell || null })) });
      await reload(); appMessage.success("报价单到收发委托单映射保存成功");
    } catch (error: any) { appMessage.error(error?.message || "报价单到收发委托单映射保存失败"); } finally { setSaving(false); }
  };
  return <div className="mapping-workbench">
    <div className="mapping-workbench-header"><div><h2>报价单 → 收发委托单</h2><p>报价单直接转换成系统统一的收发委托单</p></div><Space><Dropdown menu={{ items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })), onClick: ({ key }) => { markMappingsChanged(); setMappings((current) => [...current, { forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }]); } }}><Button icon={<PlusOutlined />} disabled={!orderTemplate}>新增特殊映射</Button></Dropdown><Button icon={<PlusOutlined />} disabled={!quote || !orderTemplate} onClick={() => { markMappingsChanged(); setMappings((current) => [...current, { sourceColumn: "", targetColumn: "" }]); }}>新增映射</Button><Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={!quoteId || !orderId} onClick={save}>保存映射</Button></Space></div>
    <div className="mapping-template-bar"><div><label>报价单模板项</label><Select showSearch optionFilterProp="label" placeholder="选择报价单模板项" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: templateLabel(item, "报价单模板"), value: item.id }))} value={quoteId} onChange={setQuoteId} /></div><div><label>收发委托单模板项</label><Select showSearch optionFilterProp="label" placeholder="选择收发委托单模板项" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: templateLabel(item, "收发委托模板"), value: item.id }))} value={orderId} onChange={setOrderId} /></div><div className="mapping-progress"><span>映射完成度 <b>{mappings.filter((item) => item.sourceColumn && item.targetColumn).length} / {mappings.length}</b></span><div><i style={{ width: mappings.length ? `${mappings.filter((item) => item.sourceColumn && item.targetColumn).length / mappings.length * 100}%` : "0%" }} /></div></div></div>
    {quote && orderTemplate ? <div className="mapping-workspace"><section className="mapping-editor"><div className="mapping-editor-title"><strong>字段映射</strong><span>报价单字段只能映射到收发委托单字段</span></div><div className="mapping-rows">{mappings.map((item, index) => { const special = Boolean(item.forcedKey); const isCell = item.targetMode === "cell" || (!item.targetMode && item.targetCell); const complete = Boolean(item.targetColumn || item.targetCell); return <div className={`mapping-item ${special ? "mapping-item-special" : ""}`} key={`${index}-${item.forcedKey || item.sourceColumn || "new"}`}><span className="mapping-item-index">{String(index + 1).padStart(2, "0")}</span><div className="mapping-field">{special ? <Input disabled value={item.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={item.sourceColumn || undefined} onChange={(value) => update(index, { sourceColumn: value })} />}</div><div className="mapping-line"><ArrowRightOutlined /></div><div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div><span className={`mapping-item-status ${complete ? "is-complete" : "is-pending"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => removeMapping(index)} /></div>; })}</div></section><aside className="mapping-preview"><h3>字段预览</h3><p className="mapping-preview-caption">A 列：报价单字段　B 列：收发委托单字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{Array.from({ length: Math.max(sourceOptions.length, targetOptions.length) }, (_, index) => <div key={index}><span>{index + 1}</span><span>{sourceOptions[index]?.value || ""}</span><span>{targetOptions[index]?.value || ""}</span></div>)}</div></div></aside></div> : <div className="mapping-guide">请先选择报价单和收发委托单模板</div>}
  </div>;
};

const QuoteMappingSettings = ({ config, reload, targetType: controlledTargetType }: any) => {
  const [localTargetType, setLocalTargetType] = useState<"import" | "order">("import");
  const targetType = controlledTargetType || localTargetType;

  return <div className="quote-mapping-page">
    {!controlledTargetType && (<div className="mapping-template-bar quote-mapping-type-bar">
      <div>
        <label>目标类型</label>
        <Radio.Group
          value={targetType}
          onChange={(event) => setLocalTargetType(event.target.value)}
          options={[
            { label: "报价单 → 导入格式", value: "import" },
            { label: "报价单 → 收发委托单", value: "order" },
          ]}
        />
      </div>
    </div>)}
    {targetType === "import"
      ? <QuoteImportMappingSettings config={config} reload={reload} />
      : <QuoteOrderMappingSettings config={config} reload={reload} />}
  </div>;
};

/** Unified mapping entry point. The target type determines which mapping model is edited. */
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

const TemplateAccordion = ({ title, count, defaultOpen = false, children, onSave, onEdit, onDelete }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  const [enabled, setEnabled] = useState(true);
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
      <button type="button" className="template-accordion-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="template-accordion-chevron">{open ? "⌃" : "⌄"}</span><span className="template-accordion-title">{title}</span><span className="template-count">{count || 0} 个模板</span>
      </button>
      <div className="template-accordion-actions">
        <Button size="small" onClick={handleEdit}>编辑</Button>
        <Popconfirm title="确定删除当前模板吗？" okText="确定" cancelText="取消" onConfirm={handleDelete}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
        <span className="template-enable-label">启用</span><Switch size="small" checked={enabled} onChange={setEnabled} />
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
        <TemplateAccordion title="收发委托模板" count={(config.uploadTemplates || []).length} onSave={() => void saveUpload().catch((error: any) => message.error(error?.message || "模板保存失败"))} onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-order .ant-table-tbody tr")?.focus()}>
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
        <TemplateAccordion title="转送对象模板" count={(config.targetTemplates || []).length} onSave={() => void saveTarget().catch((error: any) => message.error(error?.message || "模板保存失败"))} onEdit={() => document.querySelector<HTMLElement>(".transfer-template-column-target .ant-table-tbody tr")?.focus()}>
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

const MappingSettings = ({ config, reload }: any) => {
  const [targetId, setTargetId] = useState<string>();
  const [uploadTemplateId, setUploadTemplateId] = useState<string>();
  const [mappings, setMappings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const { message: appMessage } = App.useApp();
  const target: Target | undefined = config.targetTemplates.find(
    (item: Target) => item.id === targetId,
  );
  const uploadTemplate: UploadTemplate | undefined =
    config.uploadTemplates.find(
      (item: UploadTemplate) => item.id === uploadTemplateId,
    );
  const sourceOptions = (uploadTemplate?.headers || []).map((header) => ({
    label: header,
    value: header,
  }));
  const targetOptions = (target?.headers || []).map((header) => ({
    label: header,
    value: header,
  }));
  useEffect(() => {
    setMappings(target?.mappings || []);
  }, [target]);
  const updateMapping = (index: number, changes: any) =>
    setMappings((current) =>
      current.map((mapping, rowIndex) =>
        rowIndex === index ? { ...mapping, ...changes } : mapping,
      ),
    );
  return (
    <Card title="映射关系">
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 240 }}
          placeholder="选择待上传模板"
          options={config.uploadTemplates.map((item: UploadTemplate) => ({
            label: templateLabel(item, "收发委托模板"),
            value: item.id,
          }))}
          value={uploadTemplateId}
          onChange={setUploadTemplateId}
        />
        <Select
          style={{ width: 240 }}
          placeholder="选择转送对象模板"
          options={config.targetTemplates.map((item: Target) => ({
            label: templateLabel(item, "转送对象模板"),
            value: item.id,
          }))}
          value={targetId}
          onChange={setTargetId}
        />
        <Button
          disabled={!target || !uploadTemplate}
          onClick={() =>
            setMappings([...mappings, { sourceColumn: "", targetColumn: "" }])
          }
          icon={<PlusOutlined />}
        >
          新增映射
        </Button>
      </Space>
      {target && (
        <>
          <Table
            pagination={false}
            dataSource={mappings}
            rowKey={(_, index) => String(index)}
            columns={[
              {
                title: "源列名",
                width: "34%",
                render: (_: unknown, row: any, index: number) =>
                  row.forcedKey ? (
                    <Input
                      disabled
                      value={row.forcedKey}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    <Select
                      style={{ width: "100%" }}
                      showSearch
                      placeholder="选择待上传模板列名"
                      options={sourceOptions}
                      value={row.sourceColumn || undefined}
                      onChange={(value) =>
                        updateMapping(index, { sourceColumn: value })
                      }
                    />
                  ),
              },
              {
                title: "目标列名/单元格",
                width: "38%",
                render: (_: unknown, row: any, index: number) =>
                  row.forcedKey ? (
                    <Space.Compact style={{ width: "100%" }}>
                      <Select
                        style={{ width: 112 }}
                        value={row.targetMode || (row.targetCell ? "cell" : "header")}
                        options={[
                          { label: "固定单元格", value: "cell" },
                          { label: "表头列", value: "header" },
                        ]}
                        disabled={row.forcedKey !== "校准日期"}
                        onChange={(value) =>
                          updateMapping(
                            index,
                            value === "cell"
                              ? { targetMode: value, targetColumn: "" }
                              : { targetMode: value, targetCell: "" },
                          )
                        }
                      />
                      {(row.targetMode || (row.targetCell ? "cell" : "header")) === "cell" ? (
                        <Input
                          placeholder="例如 B2"
                          value={row.targetCell}
                          onChange={(event) =>
                            updateMapping(index, { targetCell: event.target.value })
                          }
                        />
                      ) : (
                        <Select
                          style={{ flex: 1 }}
                          showSearch
                          placeholder="选择目标表头列"
                          options={targetOptions}
                          value={row.targetColumn || row.forcedKey || undefined}
                          onChange={(value) =>
                            updateMapping(index, { targetColumn: value })
                          }
                        />
                      )}
                    </Space.Compact>
                  ) : (
                    <Select
                      style={{ width: "100%" }}
                      showSearch
                      placeholder="选择转送对象模板列名"
                      options={targetOptions}
                      value={row.targetColumn || undefined}
                      onChange={(value) =>
                        updateMapping(index, { targetColumn: value })
                      }
                    />
                  ),
              },
              {
                title: "强制项",
                width: "28%",
                render: (_: unknown, row: any, index: number) => (
                  <Select
                    style={{ width: "100%" }}
                    allowClear
                    placeholder="非必选"
                    options={["证书单位", "证书地址", "校准日期"].map(
                      (item) => ({ label: item, value: item }),
                    )}
                    value={row.forcedKey || undefined}
                    onChange={(value) =>
                      updateMapping(
                        index,
                        value
                          ? {
                              forcedKey: value,
                              sourceColumn: "",
                              targetColumn: "",
                              targetMode: value === "校准日期" ? "header" : "cell",
                            }
                          : { forcedKey: null, targetCell: "" },
                      )
                    }
                  />
                ),
              },
            ]}
          />
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            loading={saving}
            disabled={!targetId}
            onClick={async () => {
              if (!targetId || saving) return;
              setSaving(true);
              try {
                await apiClient.post(
                  `/one-click-transfer/target-templates/${targetId}/mappings`,
                  {
                    mappings: mappings.map((mapping) => ({
                      sourceColumn: mapping.sourceColumn || null,
                      targetColumn: mapping.targetColumn || null,
                      forcedKey: mapping.forcedKey || null,
                      targetCell: mapping.targetCell || null,
                    })),
                  },
                );
                await reload();
                appMessage.success("映射保存成功");
              } catch (error: any) {
                appMessage.error(error?.message || "映射保存失败");
              } finally {
                setSaving(false);
              }
            }}
          >
            保存映射
          </Button>
        </>
      )}
    </Card>
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
    quote: ["import", "order"],
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
      current = specific.length ? specific : allMappings.filter((item: any) => !item.upload_template_id);
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
              items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })),
              onClick: ({ key }) => appendMapping({ forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }),
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
                <div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div>
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
