import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import {
  App,
  Button,
  Card,
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
  Table,
  Tabs,
  Tag,
  Tooltip,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  PlusOutlined,
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
  match_column?: string;
  headers?: string[];
};
type ImportTemplate = {
  id: string;
  name: string;
  header_row: number;
  data_start_row: number;
  file_name?: string;
  headers?: string[];
  match_column?: string;
};
type QuoteTemplate = {
  id: string;
  name: string;
  header_row: number;
  data_start_row: number;
  file_name?: string;
  headers?: string[];
};
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
      data.set("templateName", config.importTemplates?.find((item: ImportTemplate) => item.id === selectedImportTemplateId)?.name || "");
      const response = await apiClient.upload(
        "/one-click-transfer/process",
        data,
      );
      if (!response.success) throw new Error(response.message);
      appMessage.success("处理完成");
      setModalOpen(false);
      setActiveTab("processing");
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
            <Card size="small" title={file.templateName || file.template_name}>
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
  const completedPanel = (
    <div className="transfer-completed">
      <Row className="transfer-completed-summary" gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="已完成任务" value={tasks.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="累计生成文件"
              value={tasks.reduce(
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
              value={tasks.reduce(
                (sum, task) => sum + (task.skipped_rows || 0),
                0,
              )}
            />
          </Card>
        </Col>
      </Row>
      {tasks.map((task) => (
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
            key: "quote-mappings",
            label: "报价单映射",
            children: <QuoteMappingSettings config={config} reload={load} />,
          },
         {
           key: "mappings",
           label: "收发委托单 → 转送对象",
           children: <ModernMappingSettings config={config} reload={load} />,
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
          <p>按模板名称和匹配列批量生成转送对象文件</p>
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
          { key: "processing", label: "处理中", children: processingPanel },
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
              {sourceType === "quote" && <Form.Item name="quoteTemplateId" label="报价单模板" rules={[{ required: true, message: "请选择报价单模板" }]}><Select showSearch optionFilterProp="label" placeholder="请选择报价单模板" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: item.name, value: item.id }))} onChange={(value) => { setQuoteTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "import" && <Form.Item name="importTemplateId" label="导入格式模板" rules={[{ required: true, message: "请选择导入格式模板" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: item.name, value: item.id }))} onChange={(value) => { setImportTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
              {sourceType === "order" && <Form.Item name="orderTemplateId" label="收发委托单模板" rules={[{ required: true, message: "请选择收发委托单模板" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: item.template_name, value: item.id }))} onChange={(value) => { setOrderTemplateId(value); setHeaders([]); setSourceFile(null); }} /></Form.Item>}
               {sourceType === "quote" && generationMode === "import" && <Form.Item name="importTemplateId" label="生成所用导入格式" rules={[{ required: true, message: "请选择导入格式模板" }]}><Select showSearch optionFilterProp="label" placeholder="请选择导入格式模板" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: item.name, value: item.id }))} onChange={setImportTemplateId} /></Form.Item>}
              {sourceType === "quote" && (generationMode === "order" || generationMode === "all") && <Form.Item name="orderTemplateId" label="生成所用收发委托单" rules={[{ required: true, message: "请选择收发委托单模板" }]}><Select showSearch optionFilterProp="label" placeholder="请选择收发委托单模板" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: item.template_name, value: item.id }))} onChange={setOrderTemplateId} /></Form.Item>}
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
            <Form.Item
              name="templateName"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: "现场", value: "现场" },
                  { label: "送检", value: "送检" },
                ]}
                placeholder="请选择模板类型"
              />
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
              { title: "模板", dataIndex: "template_name" },
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
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
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
    if (!uploadFile && !editingUpload?.file_path) return;
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
    if (!targetFile && !editingTarget?.file_path) return;
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
      templateName: row.template_name,
      headerRow: row.header_row,
      dataStartRow: row.data_start_row,
    });
  };
  const editTarget = (row: any) => {
    setEditingTarget(row);
    setTargetFile(undefined);
    targetForm.setFieldsValue({
      name: row.name,
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
            <Form.Item
              name="templateName"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Input placeholder="例如：收发委托单" />
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
              { title: "模板", dataIndex: "template_name" },
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
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Input />
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
  const [form] = Form.useForm();
  const [file, setFile] = useState<File>();
  const [editing, setEditing] = useState<any>();
  const save = async () => {
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择报价单模板文件");
    const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    if (editing?.id) data.append("id", editing.id); if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/quote-templates", data); await reload();
    form.resetFields(); setFile(undefined); setEditing(undefined);
  };
  const edit = (row: any) => { setEditing(row); form.setFieldsValue({ name: row.name, headerRow: row.header_row, dataStartRow: row.data_start_row }); };
  const remove = async (row: any) => { await apiClient.delete(`/one-click-transfer/quote-templates/${row.id}`); await reload(); };
  return <Card title="报价单模板">
     <Form form={form} layout="vertical" className="transfer-template-form">
      <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input placeholder="例如：报价单默认格式" /></Form.Item>
       <Form.Item name="headerRow" label="表头行号" initialValue={1} rules={[{ required: true }]}><Input /></Form.Item>
       <Form.Item name="dataStartRow" label="数据起始行号" initialValue={2} rules={[{ required: true }]}><Input /></Form.Item>
       <div className="transfer-template-spacer" aria-hidden="true" />
       <Upload beforeUpload={async (next) => { setFile(await snapshotUploadFile(next)); return false; }} maxCount={1} accept=".xlsx,.xls"><Button icon={<PlusOutlined />}>选择报价单文件</Button></Upload>
       <div className="transfer-template-current-file">{editing && !file ? `当前文件：${editing.file_name}` : ""}</div>
      <Space className="transfer-template-actions"><Button type="primary" onClick={save}>{editing ? "更新" : "保存模板"}</Button>{editing && <Button onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
    </Form>
    <Table size="small" pagination={false} rowKey="id" dataSource={config.quoteTemplates || []} columns={[{ title: "模板", dataIndex: "name" }, { title: "表头行", dataIndex: "header_row" }, { title: "文件", dataIndex: "file_name" }, { title: "操作", render: (_: any, row: any) => <Space><Button type="link" onClick={() => edit(row)}>修改</Button><Button type="link" danger onClick={() => remove(row)}>删除</Button></Space> }]} />
  </Card>;
};

const ImportTemplateSettings = ({ config, reload }: any) => {
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
    const values = await form.validateFields();
    if (!file && !editing?.file_path) throw new Error("请选择导入格式文件");
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.append(key, String(value ?? "")));
    if (editing?.id) data.append("id", editing.id);
    if (file) data.append("file", file);
    await apiClient.upload("/one-click-transfer/import-templates", data);
    await reload();
    form.resetFields(); setFile(undefined); setHeaders([]); setEditing(undefined);
  };
  const edit = (row: any) => { setEditing(row); setHeaders(row.headers || []); form.setFieldsValue({ name: row.name, headerRow: row.header_row, dataStartRow: row.data_start_row, matchColumn: row.match_column }); };
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
      <Form.Item name="name" label="格式名称" rules={[{ required: true }]}><Input placeholder="例如：报价单默认导入格式" /></Form.Item>
      <Form.Item name="headerRow" label="表头行号" initialValue={1} rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="dataStartRow" label="数据起始行号" initialValue={2} rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="matchColumn" label="转送匹配列" rules={[{ required: true, message: "请选择转送匹配列" }]}><Select placeholder={headers.length ? "请选择转送匹配列" : "请先选择Excel文件"} options={headers.map((header) => ({ label: header, value: header }))} /></Form.Item>
       <Upload
         fileList={file ? [{ uid: file.name, name: file.name, status: "done" as const }] : []}
         beforeUpload={async (next) => { const snapshot = await snapshotUploadFile(next); setFile(snapshot); setHeaders(await readHeaders(snapshot, Number(form.getFieldValue("headerRow") || 1))); return false; }}
         onRemove={() => { setFile(undefined); setHeaders(editing?.headers || []); return true; }}
         maxCount={1}
         accept=".xlsx,.xls"
       >
         <Button icon={<PlusOutlined />}>选择导入格式文件</Button>
       </Upload>
       <div className="transfer-template-current-file">{editing && !file ? `当前文件：${editing.file_name}` : ""}</div>
      <Space className="transfer-template-actions"><Button type="primary" onClick={save}>{editing ? "更新格式" : "保存格式"}</Button>{editing && <Button onClick={() => { setEditing(undefined); setFile(undefined); form.resetFields(); }}>取消</Button>}</Space>
    </Form>
    <Table size="small" pagination={false} rowKey="id" dataSource={config.importTemplates || []} columns={[
      { title: "格式名称", dataIndex: "name" }, { title: "表头行", dataIndex: "header_row" }, { title: "数据起始行", dataIndex: "data_start_row" }, { title: "文件", dataIndex: "file_name" },
      { title: "操作", render: (_: any, row: any) => <Space><Button type="link" onClick={() => edit(row)}>修改</Button><Button type="link" danger onClick={() => remove(row)}>删除</Button></Space> },
    ]} />
  </Card>;
};

const QuoteImportMappingSettings = ({ config, reload }: any) => {
  const { message: appMessage } = App.useApp();
  const [quoteId, setQuoteId] = useState<string>(); const [importId, setImportId] = useState<string>(); const [mappings, setMappings] = useState<any[]>([]); const [saving, setSaving] = useState(false);
  const suggestionVersion = useRef(0);
  const quote = (config.quoteTemplates || []).find((item: QuoteTemplate) => item.id === quoteId); const importTemplate = (config.importTemplates || []).find((item: ImportTemplate) => item.id === importId);
  useEffect(() => {
    if (!quoteId || !importId) { setMappings([]); return; }
    const requestVersion = ++suggestionVersion.current;
    const current = (config.quoteMappings || []).filter((item: any) => item.quote_template_id === quoteId && item.import_template_id === importId);
    if (current.length) { setMappings(current); return; }
    let cancelled = false;
    void apiClient.get(`/one-click-transfer/quote-mappings/suggest?quoteTemplateId=${encodeURIComponent(quoteId)}&importTemplateId=${encodeURIComponent(importId)}`).then((response: any) => { if (!cancelled && requestVersion === suggestionVersion.current && response.success) setMappings(response.data || []); });
    return () => { cancelled = true; };
  }, [quoteId, importId, config.quoteMappings]);
  const markMappingsChanged = () => { suggestionVersion.current += 1; };
  const update = (index: number, changes: any) => { markMappingsChanged(); setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); };
  const appendMapping = (mapping: any) => { markMappingsChanged(); setMappings((current) => [...current, mapping]); };
  const removeMapping = (index: number) => { markMappingsChanged(); setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
  const save = async () => { if (!quoteId || !importId || saving) return; setSaving(true); try { await apiClient.post(`/one-click-transfer/quote-templates/${quoteId}/mappings`, { importTemplateId: importId, mappings: mappings.map((item) => ({ sourceColumn: item.sourceColumn || null, targetColumn: item.targetColumn || null, forcedKey: item.forcedKey || null, targetCell: item.targetCell || null })) }); await reload(); appMessage.success("报价单映射保存成功"); } catch (error: any) { appMessage.error(error?.message || "报价单映射保存失败"); } finally { setSaving(false); } };
  const sourceOptions = (quote?.headers || []).map((value: string) => ({ label: value, value })); const targetOptions = (importTemplate?.headers || []).map((value: string) => ({ label: value, value }));
  return <div className="mapping-workbench"><div className="mapping-workbench-header"><div><h2>报价单 → 导入格式</h2><p>报价单是后续生成导入格式和收发委托单的基础</p></div><Space><Dropdown menu={{ items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })), onClick: ({ key }) => appendMapping({ forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }) }}><Button icon={<PlusOutlined />} disabled={!importTemplate}>新增特殊映射</Button></Dropdown><Button icon={<PlusOutlined />} disabled={!quote || !importTemplate} onClick={() => appendMapping({ sourceColumn: "", targetColumn: "" })}>新增映射</Button><Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={!quoteId || !importId} onClick={save}>保存映射</Button></Space></div><div className="mapping-template-bar"><div><label>报价单模板</label><Select showSearch optionFilterProp="label" placeholder="选择报价单模板" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: item.name, value: item.id }))} value={quoteId} onChange={setQuoteId} /></div><div><label>导入格式模板</label><Select showSearch optionFilterProp="label" placeholder="选择导入格式模板" options={(config.importTemplates || []).map((item: ImportTemplate) => ({ label: item.name, value: item.id }))} value={importId} onChange={setImportId} /></div><div className="mapping-progress"><span>映射完成度 <b>{mappings.filter((item) => item.targetColumn || item.targetCell).length} / {mappings.length}</b></span><div><i style={{ width: mappings.length ? `${mappings.filter((item) => item.targetColumn || item.targetCell).length / mappings.length * 100}%` : "0%" }} /></div></div></div>{quote && importTemplate ? <div className="mapping-workspace"><section className="mapping-editor"><div className="mapping-editor-title"><strong>字段映射</strong><span>报价单字段 → 导入格式字段</span></div><div className="mapping-rows">{mappings.map((item, index) => { const special = Boolean(item.forcedKey); const isCell = item.targetMode === "cell" || (!item.targetMode && item.targetCell); const complete = Boolean(item.targetColumn || item.targetCell); return <div className={`mapping-item ${special ? "mapping-item-special" : ""}`} key={`${index}-${item.forcedKey || item.sourceColumn || "new"}`}><span className="mapping-item-index">{String(index + 1).padStart(2, "0")}</span><div className="mapping-field">{special ? <Input disabled value={item.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={item.sourceColumn || undefined} onChange={(value) => update(index, { sourceColumn: value })} />}</div><div className="mapping-line"><ArrowRightOutlined /></div><div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div><span className={`mapping-item-status ${complete ? "is-complete" : "is-pending"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => removeMapping(index)} /></div>; })}</div></section><aside className="mapping-preview"><h3>字段预览</h3><p className="mapping-preview-caption">A 列：报价单字段　B 列：导入格式字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{Array.from({ length: Math.max(sourceOptions.length, targetOptions.length) }, (_, index) => <div key={index}><span>{index + 1}</span><span>{sourceOptions[index]?.value || ""}</span><span>{targetOptions[index]?.value || ""}</span></div>)}</div></div></aside></div> : <div className="mapping-guide">请先选择报价单和导入格式模板</div>}</div>;
};

const QuoteOrderMappingSettings = ({ config, reload }: any) => {
  const { message: appMessage } = App.useApp();
  const [quoteId, setQuoteId] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [mappings, setMappings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const suggestionVersion = useRef(0);
  const quote = (config.quoteTemplates || []).find((item: QuoteTemplate) => item.id === quoteId);
  const orderTemplate = (config.orderTemplates || config.uploadTemplates || []).find((item: UploadTemplate) => item.id === orderId);
  useEffect(() => {
    if (!quoteId || !orderId) { setMappings([]); return; }
    const current = (config.quoteOrderMappings || []).filter((item: any) => item.quote_template_id === quoteId && item.order_template_id === orderId);
    if (current.length) { setMappings(current); return; }
    let cancelled = false;
    void apiClient.get(`/one-click-transfer/quote-order-mappings/suggest?quoteTemplateId=${encodeURIComponent(quoteId)}&orderTemplateId=${encodeURIComponent(orderId)}`).then((response: any) => { if (!cancelled && response.success) setMappings(response.data || []); });
    return () => { cancelled = true; };
  }, [quoteId, orderId, config.quoteOrderMappings]);
  const update = (index: number, changes: any) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
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
    <div className="mapping-workbench-header"><div><h2>报价单 → 收发委托单</h2><p>报价单直接转换成系统统一的收发委托单</p></div><Space><Dropdown menu={{ items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })), onClick: ({ key }) => setMappings((current) => [...current, { forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }]) }}><Button icon={<PlusOutlined />} disabled={!orderTemplate}>新增特殊映射</Button></Dropdown><Button icon={<PlusOutlined />} disabled={!quote || !orderTemplate} onClick={() => setMappings((current) => [...current, { sourceColumn: "", targetColumn: "" }])}>新增映射</Button><Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={!quoteId || !orderId} onClick={save}>保存映射</Button></Space></div>
    <div className="mapping-template-bar"><div><label>报价单模板</label><Select showSearch optionFilterProp="label" placeholder="选择报价单模板" options={(config.quoteTemplates || []).map((item: QuoteTemplate) => ({ label: item.name, value: item.id }))} value={quoteId} onChange={setQuoteId} /></div><div><label>收发委托单模板</label><Select showSearch optionFilterProp="label" placeholder="选择收发委托单模板" options={(config.orderTemplates || config.uploadTemplates || []).map((item: UploadTemplate) => ({ label: item.template_name, value: item.id }))} value={orderId} onChange={setOrderId} /></div><div className="mapping-progress"><span>映射完成度 <b>{mappings.filter((item) => item.sourceColumn && item.targetColumn).length} / {mappings.length}</b></span><div><i style={{ width: mappings.length ? `${mappings.filter((item) => item.sourceColumn && item.targetColumn).length / mappings.length * 100}%` : "0%" }} /></div></div></div>
    {quote && orderTemplate ? <div className="mapping-workspace"><section className="mapping-editor"><div className="mapping-editor-title"><strong>字段映射</strong><span>报价单字段只能映射到收发委托单字段</span></div><div className="mapping-rows">{mappings.map((item, index) => { const special = Boolean(item.forcedKey); const isCell = item.targetMode === "cell" || (!item.targetMode && item.targetCell); const complete = Boolean(item.targetColumn || item.targetCell); return <div className={`mapping-item ${special ? "mapping-item-special" : ""}`} key={`${index}-${item.forcedKey || item.sourceColumn || "new"}`}><span className="mapping-item-index">{String(index + 1).padStart(2, "0")}</span><div className="mapping-field">{special ? <Input disabled value={item.forcedKey} /> : <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={sourceOptions} value={item.sourceColumn || undefined} onChange={(value) => update(index, { sourceColumn: value })} />}</div><div className="mapping-line"><ArrowRightOutlined /></div><div className="mapping-field">{special ? <Space.Compact block><Select style={{ width: 112 }} value={isCell ? "cell" : "header"} options={[{ label: "目标列", value: "header" }, { label: "单元格", value: "cell" }]} disabled={!['校准日期', '检定日期'].includes(item.forcedKey)} onChange={(value) => update(index, value === "cell" ? { targetMode: value, targetColumn: "" } : { targetMode: value, targetCell: "" })} />{isCell ? <Input placeholder="例如 B2" value={item.targetCell} onChange={(event) => update(index, { targetCell: event.target.value })} /> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</Space.Compact> : <Select showSearch optionFilterProp="label" placeholder="选择目标字段" options={targetOptions} value={item.targetColumn || undefined} onChange={(value) => update(index, { targetColumn: value })} />}</div><span className={`mapping-item-status ${complete ? "is-complete" : "is-pending"}`}>{complete ? <CheckCircleOutlined /> : "●"} {complete ? "已匹配" : "待配置"}</span><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></div>; })}</div></section><aside className="mapping-preview"><h3>字段预览</h3><p className="mapping-preview-caption">A 列：报价单字段　B 列：收发委托单字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{Array.from({ length: Math.max(sourceOptions.length, targetOptions.length) }, (_, index) => <div key={index}><span>{index + 1}</span><span>{sourceOptions[index]?.value || ""}</span><span>{targetOptions[index]?.value || ""}</span></div>)}</div></div></aside></div> : <div className="mapping-guide">请先选择报价单和收发委托单模板</div>}
  </div>;
};

const QuoteMappingSettings = ({ config, reload }: any) => {
  const [targetType, setTargetType] = useState<"import" | "order">("import");

  return <div className="quote-mapping-page">
    <div className="mapping-template-bar quote-mapping-type-bar">
      <div>
        <label>目标类型</label>
        <Radio.Group
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
          options={[
            { label: "报价单 → 导入格式", value: "import" },
            { label: "报价单 → 收发委托单", value: "order" },
          ]}
        />
      </div>
    </div>
    {targetType === "import"
      ? <QuoteImportMappingSettings config={config} reload={reload} />
      : <QuoteOrderMappingSettings config={config} reload={reload} />}
  </div>;
};

const TemplateSettingsManagerV2 = ({ config, reload }: any) => {
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
    return false;
  };
  const saveUpload = async () => {
    const values = await uploadForm.validateFields();
    if (!uploadFile && !editingUpload?.file_path) return;
    const matchColumn =
      values.matchColumn || editingUpload?.match_column;
    if (!matchColumn) throw new Error("请先选择Excel文件以读取匹配列");
    const data = new FormData();
    Object.entries({ ...values, matchColumn }).forEach(([key, value]) =>
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
  };
  const saveTarget = async () => {
    const values = await targetForm.validateFields();
    if (!targetFile && !editingTarget?.file_path) return;
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
    setTargetUploadKey((key) => key + 1);
    setEditingTarget(undefined);
  };
  const editUpload = (row: any) => {
    setEditingUpload(row);
    setUploadHeaders(row.headers || []);
    uploadForm.setFieldsValue({
      templateName: row.template_name,
      headerRow: row.header_row,
      dataStartRow: row.data_start_row,
      matchColumn: row.match_column,
    });
  };
  const editTarget = (row: any) => {
    setEditingTarget(row);
    setTargetFile(undefined);
    setTargetUploadKey((key) => key + 1);
    targetForm.setFieldsValue({
      name: row.name,
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
        <QuoteTemplateSettings config={config} reload={reload} />
      </section>
      <section className="transfer-template-column transfer-template-column-import">
        <ImportTemplateSettings config={config} reload={reload} />
      </section>
      <section className="transfer-template-column transfer-template-column-order">
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
              name="templateName"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Input placeholder="请输入模板名称" />
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
              <Button type="primary" onClick={saveUpload}>
                {editingUpload ? "更新" : "保存"}
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
              { title: "模板", dataIndex: "template_name" },
              { title: "转送匹配列", dataIndex: "match_column" },
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
      </section>
      <section className="transfer-template-column transfer-template-column-target">
        <Card title="转送对象模板">
          <Form form={targetForm} layout="vertical" className="transfer-template-form">
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true }]}
            >
              <Input />
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
                return false;
              }}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<PlusOutlined />}>选择Excel文件</Button>
            </Upload>
            <div className="transfer-template-current-file">{editingTarget && !targetFile && editingTarget.file_name ? `当前文件：${editingTarget.file_name}` : ""}</div>
            <Space className="transfer-template-actions">
              <Button type="primary" onClick={saveTarget}>
                {editingTarget ? "更新" : "保存模板"}
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
            label: item.template_name,
            value: item.id,
          }))}
          value={uploadTemplateId}
          onChange={setUploadTemplateId}
        />
        <Select
          style={{ width: 240 }}
          placeholder="选择转送对象模板"
          options={config.targetTemplates.map((item: Target) => ({
            label: item.name,
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
  const [targetId, setTargetId] = useState<string>();
  const [uploadTemplateId, setUploadTemplateId] = useState<string>();
  const [sourceType, setSourceType] = useState<"order" | "import">("order");
  const [mappings, setMappings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const suggestionVersion = useRef(0);
  const target = config.targetTemplates.find((item: Target) => item.id === targetId);
  const uploadTemplate = sourceType === "import"
    ? (config.importTemplates || []).find((item: ImportTemplate) => item.id === uploadTemplateId)
    : config.uploadTemplates.find((item: UploadTemplate) => item.id === uploadTemplateId);
  const sourceOptions = (uploadTemplate?.headers || []).map((header) => ({ label: header, value: header }));
  const targetOptions = (target?.headers || []).map((header) => ({ label: header, value: header }));
  const previewRows = Array.from(
    { length: Math.max(sourceOptions.length, targetOptions.length) },
    (_, index) => ({ source: sourceOptions[index]?.value || "", target: targetOptions[index]?.value || "" }),
  );
  const matchedCount = mappings.filter((item) => item.targetColumn || item.targetCell).length;
  const markMappingsChanged = () => { suggestionVersion.current += 1; };
  const update = (index: number, changes: any) => { markMappingsChanged(); setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); };
  const appendMapping = (mapping: any) => { markMappingsChanged(); setMappings((current) => [...current, mapping]); };
  const removeMapping = (index: number) => { markMappingsChanged(); setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
  useEffect(() => {
    if (!uploadTemplateId || !targetId) { setMappings([]); return; }
    const requestVersion = ++suggestionVersion.current;
    const allMappings = target?.mappings || [];
    const specific = allMappings.filter((item: any) => item.upload_template_id === uploadTemplateId);
    const current = specific.length ? specific : allMappings.filter((item: any) => !item.upload_template_id);
    if (current.length) { setMappings(current); return; }
    let cancelled = false;
    void apiClient.get(`/one-click-transfer/mappings/suggest?uploadTemplateId=${encodeURIComponent(uploadTemplateId)}&targetTemplateId=${encodeURIComponent(targetId)}`).then((response: any) => {
      if (!cancelled && requestVersion === suggestionVersion.current && response.success) setMappings(response.data || []);
    });
    return () => { cancelled = true; };
  }, [uploadTemplateId, targetId, sourceType]);
  const save = async () => {
    if (!targetId || saving) return;
    setSaving(true);
    try {
      await apiClient.post(`/one-click-transfer/target-templates/${targetId}/mappings`, {
        uploadTemplateId,
        mappings: mappings.map((item) => ({ sourceColumn: item.sourceColumn || null, sourceColumn2: item.sourceColumn2 || null, targetColumn: item.targetColumn || null, forcedKey: item.forcedKey || null, targetCell: item.targetCell || null })),
      });
      await reload();
      appMessage.success("映射保存成功");
    } catch (error: any) {
      appMessage.error(error?.message || "映射保存失败");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mapping-workbench">
      <div className="mapping-workbench-header">
        <div>
          <h2>映射关系</h2>
          <p>建立源模板与转送模板字段之间的对应关系</p>
        </div>
        <Space>
          <Dropdown
            menu={{
              items: ["证书单位", "证书地址", "校准日期"].map((key) => ({ key, label: key })),
              onClick: ({ key }) => appendMapping({ forcedKey: key, targetMode: key === "校准日期" ? "header" : "cell" }),
            }}
          >
            <Button icon={<PlusOutlined />} disabled={!target}>新增特殊映射</Button>
          </Dropdown>
          <Button icon={<PlusOutlined />} disabled={!target || !uploadTemplate} onClick={() => appendMapping({ sourceColumn: "", targetColumn: "" })}>新增映射</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={!targetId} onClick={save}>保存映射</Button>
        </Space>
      </div>
      <div className="mapping-template-bar">
        <div><label>源类型</label><Radio.Group value={sourceType} onChange={(event) => { setSourceType(event.target.value); setUploadTemplateId(undefined); setMappings([]); }} options={[{ label: "收发委托单", value: "order" }, { label: "导入格式", value: "import" }]} /></div>
        <div><label>源模板</label><Select showSearch optionFilterProp="label" placeholder="选择源模板" options={(sourceType === "import" ? config.importTemplates || [] : config.uploadTemplates || []).map((item: any) => ({ label: item.template_name || item.name, value: item.id }))} value={uploadTemplateId} onChange={setUploadTemplateId} /></div>
        <div><label>目标模板</label><Select showSearch optionFilterProp="label" placeholder="选择转送模板" options={config.targetTemplates.map((item: Target) => ({ label: item.name, value: item.id }))} value={targetId} onChange={(value) => { setTargetId(value); const next = config.targetTemplates.find((item: Target) => item.id === value); setMappings(next?.mappings || []); }} /></div>
        <div className="mapping-progress"><span>映射完成度 <b>{matchedCount} / {mappings.length}</b></span><div><i style={{ width: mappings.length ? `${matchedCount / mappings.length * 100}%` : "0%" }} /></div></div>
      </div>
      {target ? <div className="mapping-workspace">
        <section className="mapping-editor">
          <div className="mapping-editor-title"><strong>字段映射</strong><span>通过选择字段完成一对一映射</span></div>
          <div className="mapping-summary"><span><i className="mapping-dot mapping-dot-success" />已匹配 {matchedCount} 项</span><span><i className="mapping-dot mapping-dot-warning" />待配置 {mappings.length - matchedCount} 项</span></div>
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
                <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除映射" onClick={() => removeMapping(index)} />
              </div>;
            })}
          </div>
        </section>
        <aside className="mapping-preview"><h3>字段预览</h3><p className="mapping-preview-caption">A 列：源模板字段　B 列：目标模板字段</p><div className="mapping-preview-sheet"><div className="sheet-head"><span>#</span><span>A（源列）</span><span>B（目标列）</span></div><div className="mapping-preview-scroll">{previewRows.map((row, index) => <div className={mappings.some((item) => item.sourceColumn === row.source || item.targetColumn === row.target) ? "sheet-active" : ""} key={`${row.source}-${row.target}-${index}`}><span>{index + 1}</span><span>{row.source}</span><span>{row.target}</span></div>)}</div></div><div className="mapping-checks"><h3>校验结果</h3><p><CheckCircleOutlined /> 已识别 {sourceOptions.length} 个源字段</p><p><CheckCircleOutlined /> 已识别 {targetOptions.length} 个目标字段</p><p><CheckCircleOutlined /> 已配置 {matchedCount} 条映射</p></div></aside>
      </div> : <div className="mapping-guide">先选择源模板和目标模板，随后即可配置字段映射。</div>}
    </div>
  );
};

export default OneClickTransferPage;
