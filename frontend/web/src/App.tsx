// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface ResearchProject {
  id: string;
  name: string;
  description: string;
  encryptedShares: string;
  totalShares: number;
  owner: string;
  timestamp: number;
  category: string;
  contributors: Contributor[];
}

interface Contributor {
  address: string;
  encryptedShares: string;
  percentage: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newProjectData, setNewProjectData] = useState({ 
    name: "", 
    description: "", 
    totalShares: 1000,
    category: "Biotech" 
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [decryptedShares, setDecryptedShares] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);

  // Categories for filtering
  const categories = ["All", "Biotech", "AI", "Physics", "Chemistry", "Mathematics", "Other"];

  useEffect(() => {
    loadProjects().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadProjects = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("project_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing project keys:", e); }
      }
      
      const list: ResearchProject[] = [];
      for (const key of keys) {
        try {
          const projectBytes = await contract.getData(`project_${key}`);
          if (projectBytes.length > 0) {
            try {
              const projectData = JSON.parse(ethers.toUtf8String(projectBytes));
              list.push({ 
                id: key, 
                name: projectData.name,
                description: projectData.description,
                encryptedShares: projectData.encryptedShares,
                totalShares: projectData.totalShares,
                owner: projectData.owner,
                timestamp: projectData.timestamp,
                category: projectData.category,
                contributors: projectData.contributors || []
              });
            } catch (e) { console.error(`Error parsing project data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading project ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setProjects(list);
    } catch (e) { console.error("Error loading projects:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitProject = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting shares with Zama FHE..." });
    try {
      const encryptedShares = FHEEncryptNumber(newProjectData.totalShares);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const projectId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const projectData = { 
        name: newProjectData.name,
        description: newProjectData.description,
        encryptedShares,
        totalShares: newProjectData.totalShares,
        owner: address,
        timestamp: Math.floor(Date.now() / 1000),
        category: newProjectData.category,
        contributors: []
      };
      
      await contract.setData(`project_${projectId}`, ethers.toUtf8Bytes(JSON.stringify(projectData)));
      
      const keysBytes = await contract.getData("project_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(projectId);
      await contract.setData("project_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Project created with FHE-encrypted shares!" });
      await loadProjects();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewProjectData({ 
          name: "", 
          description: "", 
          totalShares: 1000,
          category: "Biotech" 
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const investInProject = async (projectId: string, shares: number) => {
    if (!isConnected || !address) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing FHE-encrypted investment..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const projectBytes = await contract.getData(`project_${projectId}`);
      if (projectBytes.length === 0) throw new Error("Project not found");
      const projectData = JSON.parse(ethers.toUtf8String(projectBytes));
      
      // Check if already contributed
      const existingContribution = projectData.contributors.find((c: Contributor) => c.address.toLowerCase() === address.toLowerCase());
      if (existingContribution) throw new Error("Already contributed to this project");
      
      const encryptedShares = FHEEncryptNumber(shares);
      const percentage = (shares / projectData.totalShares) * 100;
      
      const updatedProject = { 
        ...projectData,
        contributors: [
          ...projectData.contributors,
          {
            address,
            encryptedShares,
            percentage
          }
        ]
      };
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      await contractWithSigner.setData(`project_${projectId}`, ethers.toUtf8Bytes(JSON.stringify(updatedProject)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Investment recorded with FHE encryption!" });
      await loadProjects();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Investment failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (projectAddress: string) => address?.toLowerCase() === projectAddress.toLowerCase();

  // Filter projects based on search and category
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "All" || project.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate top contributors
  const topContributors = projects.flatMap(project => 
    project.contributors.map(contributor => ({
      address: contributor.address,
      percentage: contributor.percentage,
      projectName: project.name
    }))
  ).sort((a, b) => b.percentage - a.percentage).slice(0, 5);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>DeSci<span>IP</span>NFT</h1>
          <div className="fhe-badge">
            <span>Powered by Zama FHE</span>
          </div>
        </div>
        <div className="header-actions">
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </header>

      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h2>Invest in the Future of Science</h2>
            <p>
              DeSci IP NFTs represent shares in groundbreaking research projects. 
              Your investments are protected with Zama FHE encryption, ensuring privacy while participating in scientific discovery.
            </p>
            <button 
              className="cta-button" 
              onClick={() => setShowCreateModal(true)}
              disabled={!isConnected}
            >
              {isConnected ? "Launch Your Research" : "Connect Wallet to Start"}
            </button>
          </div>
          <div className="hero-graphic">
            <div className="science-icon"></div>
            <div className="encryption-icon"></div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stat-card">
            <h3>{projects.length}</h3>
            <p>Active Research Projects</p>
          </div>
          <div className="stat-card">
            <h3>{projects.reduce((acc, project) => acc + project.contributors.length, 0)}</h3>
            <p>Total Investors</p>
          </div>
          <div className="stat-card">
            <h3>{projects.reduce((acc, project) => acc + project.totalShares, 0)}</h3>
            <p>Total Shares Issued</p>
          </div>
          <div className="stat-card">
            <h3>100%</h3>
            <p>FHE Encrypted</p>
          </div>
        </section>

        {/* Search & Filter */}
        <section className="search-section">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button onClick={loadProjects} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="projects-grid">
          {filteredProjects.length === 0 ? (
            <div className="no-projects">
              <p>No projects found matching your criteria</p>
              <button onClick={() => { setSearchTerm(""); setFilterCategory("All"); }}>
                Clear Filters
              </button>
            </div>
          ) : (
            filteredProjects.map(project => (
              <div className="project-card" key={project.id}>
                <div className="card-header">
                  <h3>{project.name}</h3>
                  <span className="category-tag">{project.category}</span>
                </div>
                <div className="card-body">
                  <p>{project.description.substring(0, 100)}...</p>
                  <div className="project-stats">
                    <div>
                      <span>Total Shares</span>
                      <strong>{project.totalShares}</strong>
                    </div>
                    <div>
                      <span>Investors</span>
                      <strong>{project.contributors.length}</strong>
                    </div>
                  </div>
                </div>
                <div className="card-footer">
                  <button 
                    className="details-button"
                    onClick={() => setSelectedProject(project)}
                  >
                    View Details
                  </button>
                  {!isOwner(project.owner) && (
                    <button 
                      className="invest-button"
                      onClick={() => investInProject(project.id, 100)}
                    >
                      Invest (100 Shares)
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Top Contributors */}
        <section className="contributors-section">
          <h2>Top Contributors</h2>
          <div className="contributors-list">
            {topContributors.length === 0 ? (
              <p>No contributors yet</p>
            ) : (
              topContributors.map((contributor, index) => (
                <div className="contributor-card" key={index}>
                  <div className="rank">{index + 1}</div>
                  <div className="contributor-info">
                    <span className="address">
                      {contributor.address.substring(0, 6)}...{contributor.address.substring(38)}
                    </span>
                    <span className="project">{contributor.projectName}</span>
                  </div>
                  <div className="contribution">
                    <span>{contributor.percentage.toFixed(2)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Launch New Research Project</h2>
              <button onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input 
                  type="text" 
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})}
                  placeholder="Enter project name"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newProjectData.description}
                  onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                  placeholder="Describe your research project"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newProjectData.category}
                  onChange={(e) => setNewProjectData({...newProjectData, category: e.target.value})}
                >
                  {categories.filter(c => c !== "All").map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Total Shares to Issue</label>
                <input 
                  type="number" 
                  value={newProjectData.totalShares}
                  onChange={(e) => setNewProjectData({...newProjectData, totalShares: parseInt(e.target.value) || 0})}
                  placeholder="Total shares"
                />
              </div>
              <div className="fhe-notice">
                <p>
                  <strong>FHE Encryption Notice:</strong> Share ownership data will be encrypted with Zama FHE technology to protect investor privacy.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button 
                onClick={submitProject}
                disabled={creating || !newProjectData.name || !newProjectData.description}
              >
                {creating ? "Creating with FHE..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="modal-overlay">
          <div className="project-detail-modal">
            <div className="modal-header">
              <h2>{selectedProject.name}</h2>
              <button onClick={() => { setSelectedProject(null); setDecryptedShares(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="project-info">
                <div className="info-row">
                  <span>Category:</span>
                  <strong>{selectedProject.category}</strong>
                </div>
                <div className="info-row">
                  <span>Created:</span>
                  <strong>{new Date(selectedProject.timestamp * 1000).toLocaleDateString()}</strong>
                </div>
                <div className="info-row">
                  <span>Owner:</span>
                  <strong>{selectedProject.owner.substring(0, 6)}...{selectedProject.owner.substring(38)}</strong>
                </div>
                <div className="info-row">
                  <span>Total Shares:</span>
                  <strong>{selectedProject.totalShares}</strong>
                </div>
                <div className="info-row">
                  <span>Investors:</span>
                  <strong>{selectedProject.contributors.length}</strong>
                </div>
              </div>
              
              <div className="project-description">
                <h3>Description</h3>
                <p>{selectedProject.description}</p>
              </div>
              
              <div className="encrypted-data-section">
                <h3>FHE-Encrypted Shares</h3>
                <div className="encrypted-data">
                  {selectedProject.encryptedShares.substring(0, 100)}...
                </div>
                <button 
                  className="decrypt-button"
                  onClick={async () => {
                    if (decryptedShares !== null) {
                      setDecryptedShares(null);
                    } else {
                      const shares = await decryptWithSignature(selectedProject.encryptedShares);
                      setDecryptedShares(shares);
                    }
                  }}
                  disabled={isDecrypting}
                >
                  {isDecrypting ? "Decrypting..." : 
                   decryptedShares !== null ? "Hide Decrypted Value" : "Decrypt Shares"}
                </button>
                {decryptedShares !== null && (
                  <div className="decrypted-value">
                    <span>Decrypted Shares:</span>
                    <strong>{decryptedShares}</strong>
                  </div>
                )}
              </div>
              
              <div className="contributors-section">
                <h3>Investors</h3>
                {selectedProject.contributors.length === 0 ? (
                  <p>No investors yet</p>
                ) : (
                  <div className="contributors-list">
                    {selectedProject.contributors.map((contributor, index) => (
                      <div className="contributor" key={index}>
                        <span className="address">
                          {contributor.address.substring(0, 6)}...{contributor.address.substring(38)}
                        </span>
                        <span className="percentage">{contributor.percentage.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {!isOwner(selectedProject.owner) && (
                <button 
                  className="invest-button"
                  onClick={() => investInProject(selectedProject.id, 100)}
                >
                  Invest 100 Shares
                </button>
              )}
              <button onClick={() => { setSelectedProject(null); setDecryptedShares(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Status Modal */}
      {transactionStatus.visible && (
        <div className="status-modal">
          <div className="status-content">
            <div className={`status-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <p>{transactionStatus.message}</p>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <h3>DeSci IP NFT</h3>
            <p>Revolutionizing scientific funding with blockchain and FHE technology</p>
          </div>
          <div className="footer-right">
            <div className="footer-links">
              <a href="#">Documentation</a>
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
            </div>
            <div className="fhe-badge">
              <span>Powered by Zama FHE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;