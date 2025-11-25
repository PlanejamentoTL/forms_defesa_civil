// src/App.jsx
import { useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

import MapUpdater from "./MapUpdater";

// Ícone padrão do Leaflet
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// URL do Apps Script (Web App /exec)
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyPYudJ5sjSDvWgskTDHdzo1T3ZmNB_5rMQQCIKO7wmHPP26_6dCxdkvcXH55mvwRBW9Q/exec";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";


// Componente que captura clique no mapa e faz reverse geocode via proxy
function LocationMarker({ onChangePosition, onChangeAddress }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;

      onChangePosition({ lat, lng });

      try {
        const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "defesa-civil-tres-lagoas-formulario"
          }
        });
        const data = await res.json();
        const addr = data.address || {};

        const rua =
          addr.road ||
          addr.pedestrian ||
          addr.residential ||
          addr.footway ||
          addr.path ||
          "";
        const numero = addr.house_number || "";
        const bairro =
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.hamlet ||
          addr.district ||
          "";
        const cidade =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          "";
        const cep = addr.postcode || "";

        const partes = [];
        if (rua) partes.push(rua);
        if (numero) partes.push(numero);
        if (bairro) partes.push(bairro);
        if (cidade) partes.push(cidade);
        if (cep) partes.push("CEP " + cep);

        onChangeAddress(partes.join(", "));
      } catch (err) {
        console.error("Erro no reverse geocode (clique no mapa):", err);
      }
    },
  });

  return null;
}

export default function App() {
  const [form, setForm] = useState({
    nomeCompleto: "",
    email: "",
    telefone: "",
    estaNoLocal: "",
    bairroIntercorrencia: "",
    enderecoDescricao: "",
    referenciaEndereco: "",
    existeCorrego: "",
    tempoRegiao: "",
    localAfetadoDrenagem: "",
    dificuldadeLocomocao: "",
    conhecimentoObras: "",
    satisfacaoObras: "",
    problemasAntes: [],
    problemasDepois: [],
    avaliacaoSituacao: "",
    frequenciaProblemas: "",
    percepcaoDrenagem: "",
    houveFeridos: "",
    latitude: "",
    longitude: "",
    enderecoAproximado: "",
    fotos: [],
  });

  // posição inicial do mapa (Três Lagoas aproximado)
  const [mapPosition, setMapPosition] = useState({
    lat: -20.75,
    lng: -51.68,
  });

  const [buscaEndereco, setBuscaEndereco] = useState("");
  const [loadingEndereco, setLoadingEndereco] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sent, setSent] = useState(false);
  // Detectar se está em dispositivo móvel
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );

  // Converte arquivos de imagem em base64 e guarda no form.fotos
  async function handleFotosChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // helper para converter um arquivo em { nome, tipo, base64 }
    const fileToBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result || "";
          // result vem como "data:image/jpeg;base64,AAAA..."
          const parts = String(result).split(",");
          resolve({
            name: file.name,
            type: file.type,
            base64: parts[1] || "",
          });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

    try {
      const converted = await Promise.all(files.map(fileToBase64));
      setForm((prev) => ({
        ...prev,
        fotos: [...(prev.fotos || []), ...converted],
      }));
    } catch (err) {
      console.error("Erro ao ler arquivos de imagem:", err);
      alert("Não foi possível carregar as fotos. Tente novamente.");
    } finally {
      // limpa o input para permitir selecionar o mesmo arquivo de novo se quiser
      e.target.value = "";
    }
  }


  // TELEFONE COM MÁSCARA
  function handlePhoneChange(e) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 6) v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    else if (v.length > 0) v = v.replace(/^(\d{0,2}).*/, "($1");

    setForm((prev) => ({ ...prev, telefone: v }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleCheckboxChange(e, fieldName) {
    const { value, checked } = e.target;
    setForm((prev) => {
      const set = new Set(prev[fieldName] || []);
      if (checked) set.add(value);
      else set.delete(value);
      return { ...prev, [fieldName]: Array.from(set) };
    });
  }

  function handleMapPositionChange({ lat, lng }) {
    setMapPosition({ lat, lng });
    setForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  }

  function handleEnderecoAproximadoChange(addr) {
    setForm((prev) => ({ ...prev, enderecoAproximado: addr }));
  }

  // BOTÃO “USAR MINHA LOCALIZAÇÃO”
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert("Seu navegador não suporta geolocalização.");
      return;
    }

    setLoadingEndereco(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        // Atualiza posição do mapa e grava lat/lon no form (para a planilha)
        handleMapPositionChange({ lat, lng });

        if (typeof accuracy === "number" && accuracy > 200) {
          alert(
            `Precisão baixa (~${Math.round(
              accuracy
            )}m). Ajuste clicando no mapa se necessário.`
          );
        }

        try {
          const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "defesa-civil-tres-lagoas-formulario"
            }
          });
          const data = await res.json();
          const addr = data.address || {};

          const rua =
            addr.road ||
            addr.pedestrian ||
            addr.residential ||
            addr.footway ||
            addr.path ||
            "";
          const numero = addr.house_number || "";
          const bairro =
            addr.neighbourhood ||
            addr.suburb ||
            addr.quarter ||
            addr.hamlet ||
            addr.district ||
            "";
          const cidade =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            "";
          const cep = addr.postcode || "";

          const partes = [];
          if (rua) partes.push(rua);
          if (numero) partes.push(numero);
          if (bairro) partes.push(bairro);
          if (cidade) partes.push(cidade);
          if (cep) partes.push("CEP " + cep);

          const enderecoFinal = partes.join(", ");

          // 👉 SOMENTE endereço escrito vai para o campo de texto
          if (enderecoFinal) {
            handleEnderecoAproximadoChange(enderecoFinal);
          } else {
            // se por algum motivo não veio endereço completo,
            // avisa o usuário para ajustar manualmente
            alert(
              'Não foi possível montar o endereço automaticamente. ' +
              'Por favor, revise ou preencha o campo "Endereço aproximado".'
            );
          }
        } catch (err) {
          console.error("Erro no reverse geocode (geolocalização):", err);
          alert(
            'Ocorreu um erro ao obter o endereço. ' +
            'Por favor, preencha o campo "Endereço aproximado" manualmente.'
          );
        } finally {
          setLoadingEndereco(false);
        }
      },
      (err) => {
        console.error("Erro de geolocalização:", err);
        alert("Não foi possível obter sua localização.");
        setLoadingEndereco(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }


  // BUSCA POR TEXTO NO MAPA (preenche endereço também)
  async function buscarEnderecoNoMapa() {
    const q = buscaEndereco.trim();
    if (!q) {
      alert("Digite um endereço para buscar.");
      return;
    }

    try {
      setLoadingEndereco(true);
      const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "defesa-civil-tres-lagoas-formulario"
        }
      });
      const arr = await res.json();
      if (!arr || arr.length === 0) {
        alert("Endereço não encontrado. Tente ser mais específico.");
        return;
      }

      const item = arr[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const addr = item.address || {};

      handleMapPositionChange({ lat, lng });

      const rua =
        addr.road ||
        addr.pedestrian ||
        addr.residential ||
        addr.footway ||
        addr.path ||
        "";
      const numero = addr.house_number || "";
      const bairro =
        addr.neighbourhood ||
        addr.suburb ||
        addr.quarter ||
        addr.hamlet ||
        addr.district ||
        "";
      const cidade =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        "";
      const cep = addr.postcode || "";

      const partes = [];
      if (rua) partes.push(rua);
      if (numero) partes.push(numero);
      if (bairro) partes.push(bairro);
      if (cidade) partes.push(cidade);
      if (cep) partes.push("CEP " + cep);

      handleEnderecoAproximadoChange(partes.join(", "));
    } catch (err) {
      console.error("Erro ao buscar endereço:", err);
      alert("Erro ao buscar o endereço.");
    } finally {
      setLoadingEndereco(false);
    }
  }

  // VALIDAR STEP
  function validateStep(i) {
    const step = steps[i];
    if (!step) return true;

    if (step.id === "localizacao") {
      if (!form.estaNoLocal) return false;

      if (form.estaNoLocal === "Sim") {
        return (
          !!form.latitude && !!form.longitude && !!form.enderecoAproximado
        );
      } else {
        return !!form.bairroIntercorrencia && !!form.enderecoDescricao;
      }
    }

    if (!step.requiredFields) return true;
    return step.requiredFields.every((f) => !!form[f]);
  }

  function handleNext() {
    if (!validateStep(currentStep)) {
      alert("Responda essa pergunta para continuar.");
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handlePrev() {
    setCurrentStep((s) => (s > 0 ? s - 1 : s));
  }

  // SUBMIT FINAL
  async function handleSubmit() {
    if (!validateStep(currentStep)) {
      alert("Preencha tudo antes de enviar.");
      return;
    }

    try {
      setSending(true);

      // Envia TUDO (inclusive fotos em base64) como JSON
      await fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",                     // 👈 evita erro de CORS
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),          // 👈 JSON com respostas + fotos
      });

      // Como no-cors não permite ler a resposta, assumimos sucesso
      setSent(true);
    } catch (err) {
      alert("Erro ao enviar as respostas.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }



  // TODAS AS PERGUNTAS
  const steps = useMemo(
    () => [
      {
        id: "nomeCompleto",
        title: "1. Nome completo",
        requiredFields: ["nomeCompleto"],
        content: (
          <input
            type="text"
            name="nomeCompleto"
            value={form.nomeCompleto}
            onChange={handleChange}
          />
        ),
      },
      {
        id: "email",
        title: "2. E-mail",
        requiredFields: ["email"],
        content: (
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
          />
        ),
      },
      {
        id: "telefone",
        title: "3. Telefone/celular",
        requiredFields: ["telefone"],
        content: (
          <input
            type="tel"
            name="telefone"
            value={form.telefone}
            onChange={handlePhoneChange}
            maxLength={15}
          />
        ),
      },
      {
        id: "estaNoLocal",
        title: "4. Você está no local do problema?",
        requiredFields: ["estaNoLocal"],
        content: (
          <div className="options">
            {["Sim", "Não"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="estaNoLocal"
                  value={opt}
                  checked={form.estaNoLocal === opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },
      {
        id: "localizacao",
        title: "5. Localização do Problema",
        requiredFields: [],
        content:
          !form.estaNoLocal ? (
            <p>Responda à pergunta anterior.</p>
          ) : form.estaNoLocal === "Sim" ? (
            <>
              <p>Use sua localização ou ajuste clicando no mapa.</p>

              <div className="search-row">
                <input
                  type="text"
                  placeholder="Buscar endereço"
                  value={buscaEndereco}
                  onChange={(e) => setBuscaEndereco(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={buscarEnderecoNoMapa}
                  disabled={loadingEndereco}
                >
                  {loadingEndereco ? "Buscando..." : "Buscar"}
                </button>
              </div>

              <div className="map-wrapper">
                <MapContainer
                  center={[
                    form.latitude || mapPosition.lat,
                    form.longitude || mapPosition.lng,
                  ]}
                  zoom={13}
                  style={{ width: "100%", height: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  <MapUpdater lat={form.latitude} lng={form.longitude} />

                  <LocationMarker
                    onChangePosition={handleMapPositionChange}
                    onChangeAddress={handleEnderecoAproximadoChange}
                  />

                  {form.latitude && form.longitude && (
                    <Marker
                      position={[form.latitude, form.longitude]}
                      icon={defaultIcon}
                    />
                  )}
                </MapContainer>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleUseMyLocation}
                disabled={loadingEndereco}
                style={{ marginTop: 12 }}
              >
                {loadingEndereco
                  ? "Obtendo localização..."
                  : "Usar minha localização"}
              </button>

              <div className="field">
                <label>Endereço aproximado</label>
                <textarea
                  rows={2}
                  value={form.enderecoAproximado}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      enderecoAproximado: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label>Referência</label>
                <input
                  type="text"
                  name="referenciaEndereco"
                  value={form.referenciaEndereco}
                  onChange={handleChange}
                />
              </div>
            </>
          ) : (
            <>
              <p>Informe o endereço do local.</p>

              <div className="field">
                <label>Bairro</label>
                <input
                  type="text"
                  name="bairroIntercorrencia"
                  value={form.bairroIntercorrencia}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Endereço (rua e número)</label>
                <input
                  type="text"
                  name="enderecoDescricao"
                  value={form.enderecoDescricao}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Referência</label>
                <input
                  type="text"
                  name="referenciaEndereco"
                  value={form.referenciaEndereco}
                  onChange={handleChange}
                />
              </div>
            </>
          ),
      },

      {
        id: "fotosIntercorrencia",
        title: "5.1. Deseja enviar fotos do local do problema?",
        requiredFields: [],
        content: (
          <div className="field">
            <p>
              Você pode anexar fotos existentes do aparelho. Em dispositivos
              móveis, também é possível tirar uma foto na hora.
            </p>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Enviar fotos (galeria / arquivos)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
              />
            </div>

            {isMobile && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Tirar foto agora (câmera)</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotosChange}
                />
              </div>
            )}

            {form.fotos && form.fotos.length > 0 && (
              <p
                style={{
                  fontSize: "0.85rem",
                  marginTop: 8,
                  color: "#555",
                }}
              >
                {form.fotos.length} foto(s) será(ão) enviada(s) junto com suas
                respostas.
              </p>
            )}
          </div>
        ),
      },


      {
        id: "existeCorrego",
        title: "6. Existe córrego, lagoa ou piscinão próximo?",
        requiredFields: ["existeCorrego"],
        content: (
          <div className="options">
            {["Sim", "Não"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="existeCorrego"
                  checked={form.existeCorrego === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "tempoRegiao",
        title: "7. Há quanto tempo mora na região?",
        requiredFields: ["tempoRegiao"],
        content: (
          <div className="options">
            {["Menos de 1 ano", "Entre 1 e 5 anos", "Mais de 5 anos"].map(
              (opt) => (
                <label key={opt}>
                  <input
                    type="radio"
                    name="tempoRegiao"
                    checked={form.tempoRegiao === opt}
                    value={opt}
                    onChange={handleChange}
                  />
                  {opt}
                </label>
              )
            )}
          </div>
        ),
      },

      {
        id: "localAfetadoDrenagem",
        title:
          "8. O local já foi afetado por problemas de drenagem (alagamentos, enxurradas, entrada de água)?",
        requiredFields: ["localAfetadoDrenagem"],
        content: (
          <div className="options">
            {["Sim", "Não"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="localAfetadoDrenagem"
                  checked={form.localAfetadoDrenagem === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "dificuldadeLocomocao",
        title:
          "9. Já enfrentou dificuldades de locomoção nessa rua devido à chuva?",
        requiredFields: ["dificuldadeLocomocao"],
        content: (
          <div className="options">
            {["Sim", "Não"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="dificuldadeLocomocao"
                  checked={form.dificuldadeLocomocao === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "conhecimentoObras",
        title:
          "10. Tem conhecimento de obras de drenagem ou pavimentação na rua ou proximidades?",
        requiredFields: ["conhecimentoObras"],
        content: (
          <div className="options">
            {["Sim", "Não"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="conhecimentoObras"
                  checked={form.conhecimentoObras === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "satisfacaoObras",
        title:
          "11. De forma geral, qual o seu nível de satisfação em relação às obras realizadas?",
        requiredFields: ["satisfacaoObras"],
        content: (
          <div className="options">
            {[
              "Satisfeito",
              "Indiferente",
              "Insatisfeito",
              "Ainda não é possível avaliar",
            ].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="satisfacaoObras"
                  checked={form.satisfacaoObras === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "problemasAntes",
        title:
          "12. Antes das obras, durante as chuvas, quais problemas observava nessa rua? (pode marcar mais de um)",
        requiredFields: [],
        content: (
          <div className="options-column">
            {[
              "Enxurradas",
              "Alagamentos",
              "Entrada de água em residências ou comércios",
              "Transbordamento de bacias de contenção",
              "Deslizamento ou risco estrutural",
              "Danos em calçadas ou no asfalto",
              "Nenhum problema",
            ].map((opt) => (
              <label key={opt}>
                <input
                  type="checkbox"
                  value={opt}
                  checked={form.problemasAntes.includes(opt)}
                  onChange={(e) =>
                    handleCheckboxChange(e, "problemasAntes")
                  }
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "problemasDepois",
        title:
          "13. Após as obras, algum desses problemas persistiu ou começou a acontecer? (pode marcar mais de um)",
        requiredFields: [],
        content: (
          <div className="options-column">
            {[
              "Enxurradas",
              "Alagamentos",
              "Entrada de água em residências ou comércios",
              "Transbordamento de bacias de contenção",
              "Deslizamento ou risco estrutural",
              "Danos em calçadas ou no asfalto",
              "Nenhum problema",
            ].map((opt) => (
              <label key={opt}>
                <input
                  type="checkbox"
                  value={opt}
                  checked={form.problemasDepois.includes(opt)}
                  onChange={(e) =>
                    handleCheckboxChange(e, "problemasDepois")
                  }
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "avaliacaoSituacao",
        title:
          "14. Comparando antes e depois das obras, como avalia a situação do local frente às chuvas?",
        requiredFields: ["avaliacaoSituacao"],
        content: (
          <div className="options">
            {[
              "Sanou",
              "Melhorou",
              "Permaneceu igual",
              "Piorou",
              "Ainda não é possível avaliar",
            ].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="avaliacaoSituacao"
                  checked={form.avaliacaoSituacao === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "frequenciaProblemas",
        title:
          "15. Quando ocorrem chuvas, com que frequência essa região ainda apresenta problemas?",
        requiredFields: ["frequenciaProblemas"],
        content: (
          <div className="options">
            {["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"].map(
              (opt) => (
                <label key={opt}>
                  <input
                    type="radio"
                    name="frequenciaProblemas"
                    checked={form.frequenciaProblemas === opt}
                    value={opt}
                    onChange={handleChange}
                  />
                  {opt}
                </label>
              )
            )}
          </div>
        ),
      },

      {
        id: "percepcaoDrenagem",
        title:
          "16. Na sua percepção, os problemas de drenagem na região ocorrem:",
        requiredFields: ["percepcaoDrenagem"],
        content: (
          <div className="options">
            {[
              "Apenas em chuvas muito fortes",
              "Também em chuvas leves e moderadas",
              "Não ocorrem",
              "Ainda não é possível avaliar",
            ].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="percepcaoDrenagem"
                  checked={form.percepcaoDrenagem === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },

      {
        id: "houveFeridos",
        title:
          "17. Nas últimas ocorrências com problemas, houve feridos ou pessoas com necessidade de abrigo temporário?",
        requiredFields: ["houveFeridos"],
        content: (
          <div className="options">
            {["Sim", "Não", "Não sei"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="houveFeridos"
                  checked={form.houveFeridos === opt}
                  value={opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
        ),
      },
    ],
    [form, buscaEndereco, mapPosition, loadingEndereco]
  );

  const totalSteps = steps.length;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  const step = steps[currentStep];

  // TELA DE OBRIGADO
  if (sent) {
    return (
      <div className="app-root">
        <div className="card">
          <header className="card-header">
            {/* BLOCO DAS LOGOS */}
            <div className="logo-row">
              <img
                src={`${import.meta.env.BASE_URL}logo-defesa-civil.png`}
                className="logo-left"
                alt="Defesa Civil"
              />
              <img
                src={`${import.meta.env.BASE_URL}logo-prefeitura.png`}
                className="logo-right"
                alt="Prefeitura Municipal de Três Lagoas"
              />
            </div>

            {/* BLOCO DO TÍTULO + SUBTÍTULO (NA MESMA LINHA DAS LOGOS) */}
            <div className="logo-title-row">
              <h1>Formulário de avaliação de drenagem urbana e impactos das chuvas</h1>
              <p className="subtitle">
                Prefeitura Municipal de Três Lagoas – Defesa Civil
              </p>
            </div>
          </header>


          <main className="step-body">
            <h2 style={{ textAlign: "center", marginTop: "24px" }}>
              Obrigado!
            </h2>
            <p style={{ textAlign: "center" }}>
              Suas respostas foram registradas com sucesso.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="card">
        <header className="card-header">
          {/* BLOCO DAS LOGOS */}
          <div className="logo-row">
            <img
              src={`${import.meta.env.BASE_URL}logo-defesa-civil.png`}
              className="logo-left"
              alt="Defesa Civil"
            />
            <img
              src={`${import.meta.env.BASE_URL}logo-prefeitura.png`}
              className="logo-right"
              alt="Prefeitura Municipal de Três Lagoas"
            />
          </div>

          {/* BLOCO DO TÍTULO + SUBTÍTULO (NA MESMA LINHA DAS LOGOS) */}
          <div className="logo-title-row">
            <h1>Formulário de avaliação de drenagem urbana e impactos das chuvas</h1>
            <p className="subtitle">
              Prefeitura Municipal de Três Lagoas – Defesa Civil
            </p>
          </div>
        </header>


        <div className="progress">
          <div
            className="progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <main className="step-body">
          <h2>{step.title}</h2>
          <div className="field">{step.content}</div>
        </main>

        <footer className="nav-buttons">
          {/* Botão ANTERIOR some visualmente na primeira pergunta */}
          {currentStep === 0 ? (
            // botão “fantasma” só pra manter o alinhamento do Próximo
            <button
              type="button"
              className="btn-secondary"
              style={{ visibility: "hidden" }}
              disabled
            >
              Anterior
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrev}
              className="btn-secondary"
              disabled={sending}
            >
              Anterior
            </button>
          )}

          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleNext}
              disabled={sending || !validateStep(currentStep)}
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={sending}
            >
              {sending ? "Enviando..." : "Enviar respostas"}
            </button>
          )}
        </footer>

      </div>
    </div>
  );
}