-- IMEC Compliance Industrial - Database Schema
-- MySQL 8.0+
-- Version: 1.0


-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'engenharia', 'rh', 'viewer', 'client') NOT NULL DEFAULT 'viewer',
    status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
    client_id INT NULL,
    password_changed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- EMPLOYEES
-- ============================================
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(20),
    birth_date DATE,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    role_position VARCHAR(255),
    department VARCHAR(255),
    admission_date DATE,
    status ENUM('ativo', 'afastado', 'desligado') NOT NULL DEFAULT 'ativo',
    photo_url MEDIUMTEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TRAININGS (NRs)
-- ============================================
CREATE TABLE trainings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    category ENUM('NR', 'Operação', 'Técnico', 'Segurança', 'Outro') NOT NULL DEFAULT 'NR',
    description TEXT,
    default_workload INT DEFAULT 16,
    default_validity_months INT DEFAULT 24,
    requires_recycling BOOLEAN DEFAULT TRUE,
    status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- CERTIFICATES
-- ============================================
CREATE TABLE certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    training_id INT NOT NULL,
    certificate_code VARCHAR(100) NOT NULL UNIQUE,
    verification_token VARCHAR(255) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    workload INT DEFAULT 0,
    instructor_name VARCHAR(255),
    issuer_company VARCHAR(255),
    technical_responsible VARCHAR(255),
    crea_number VARCHAR(50),
    pdf_url MEDIUMTEXT,
    card_image_url MEDIUMTEXT,
    status ENUM('valido', 'vencendo', 'vencido', 'cancelado') NOT NULL DEFAULT 'valido',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- MEDICAL EXAMS (ASO)
-- ============================================
CREATE TABLE medical_exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    exam_type ENUM('admissional', 'periódico', 'mudança de função', 'retorno ao trabalho', 'demissional') NOT NULL,
    issue_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    doctor_name VARCHAR(255),
    crm VARCHAR(50),
    aptitude_result ENUM('apto', 'inapto', 'apto_restricao') NOT NULL DEFAULT 'apto',
    role_position VARCHAR(255),
    pdf_url MEDIUMTEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- EPI RECORDS
-- ============================================
CREATE TABLE epi_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    ca_number VARCHAR(50),
    manufacturer VARCHAR(255),
    ca_validity DATE,
    equipment_validity DATE,
    current_stock INT DEFAULT 0,
    minimum_stock INT DEFAULT 0,
    notes TEXT,
    status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE epi_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    epi_catalog_id INT NULL,
    epi_name VARCHAR(255) NOT NULL,
    ca_number VARCHAR(50),
    quantity INT DEFAULT 1,
    delivery_date DATE NOT NULL,
    replacement_date DATE,
    delivery_signature MEDIUMTEXT,
    delivery_signature_method VARCHAR(50),
    return_date DATE,
    return_condition VARCHAR(50),
    return_signature MEDIUMTEXT,
    return_signature_method VARCHAR(50),
    responsible_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'entregue',
    return_notes TEXT,
    attachment_url MEDIUMTEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (epi_catalog_id) REFERENCES epi_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- EQUIPMENT
-- ============================================
CREATE TABLE equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    brand VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    asset_number VARCHAR(100),
    plate VARCHAR(20),
    year VARCHAR(10),
    capacity VARCHAR(100),
    owner VARCHAR(255),
    status ENUM('ativo', 'manutencao', 'inativo') NOT NULL DEFAULT 'ativo',
    photo_url MEDIUMTEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- EQUIPMENT DOCUMENTS
-- ============================================
CREATE TABLE equipment_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipment_id INT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiration_date DATE,
    responsible_name VARCHAR(255),
    file_url MEDIUMTEXT,
    status ENUM('valido', 'vencendo', 'vencido') NOT NULL DEFAULT 'valido',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    contact_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_id INT,
    location TEXT,
    start_date DATE,
    expected_end_date DATE,
    status ENUM('planejada', 'em_andamento', 'concluida', 'paralisada', 'cancelada') NOT NULL DEFAULT 'planejada',
    service_description TEXT,
    technical_responsible VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- PROJECT EMPLOYEES
-- ============================================
CREATE TABLE project_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    employee_id INT NOT NULL,
    role_in_project VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_employee (project_id, employee_id)
) ENGINE=InnoDB;

-- ============================================
-- PROJECT EQUIPMENT
-- ============================================
CREATE TABLE project_equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    equipment_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_equipment (project_id, equipment_id)
) ENGINE=InnoDB;

-- ============================================
-- TECHNICAL DOCUMENTS
-- ============================================
CREATE TABLE technical_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    client_id INT,
    project_id INT,
    equipment_id INT,
    employee_id INT,
    responsible_name VARCHAR(255),
    crea_number VARCHAR(50),
    issue_date DATE,
    expiration_date DATE,
    file_url MEDIUMTEXT,
    status ENUM('valido', 'vencendo', 'vencido') NOT NULL DEFAULT 'valido',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- COMPETENCY REQUIREMENTS
-- ============================================
CREATE TABLE competency_requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_name VARCHAR(255) NOT NULL,
    required_training_ids JSON,
    requires_aso BOOLEAN DEFAULT FALSE,
    requires_epi BOOLEAN DEFAULT FALSE,
    requires_client_integration BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) DEFAULT 'IMEC Soluções Industriais',
    cnpj VARCHAR(20),
    logo_url VARCHAR(500),
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    technical_responsible VARCHAR(255),
    crea_number VARCHAR(50),
    signature_url VARCHAR(500),
    expiration_alert_days INT DEFAULT 30,
    allow_public_pdf_view BOOLEAN DEFAULT TRUE,
    report_footer TEXT,
    notification_email VARCHAR(255),
    smtp_host VARCHAR(255),
    smtp_port INT DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT FALSE,
    smtp_user VARCHAR(255),
    smtp_pass VARCHAR(255),
    smtp_from VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_certificates_employee ON certificates(employee_id);
CREATE INDEX idx_certificates_training ON certificates(training_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_token ON certificates(verification_token);
CREATE INDEX idx_certificates_code ON certificates(certificate_code);
CREATE INDEX idx_medical_exams_employee ON medical_exams(employee_id);
CREATE INDEX idx_epi_employee ON epi_records(employee_id);
CREATE INDEX idx_equipment_docs_equipment ON equipment_documents(equipment_id);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_project_employees_project ON project_employees(project_id);
CREATE INDEX idx_project_equipment_project ON project_equipment(project_id);
CREATE INDEX idx_tech_docs_project ON technical_documents(project_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Default admin user (password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (name, email, password, role, status) VALUES
('Administrador', 'admin@imec.com.br', '$2a$10$HSMPs0z8tzrFDqVTlugZqOqA7OwOg3sBf8VL4RgSvKdUUU8o3h6n6', 'admin', 'ativo'),
('Eng. Roberto', 'eng@imec.com.br', '$2a$10$HSMPs0z8tzrFDqVTlugZqOqA7OwOg3sBf8VL4RgSvKdUUU8o3h6n6', 'engenharia', 'ativo'),
('Ana (RH)', 'rh@imec.com.br', '$2a$10$HSMPs0z8tzrFDqVTlugZqOqA7OwOg3sBf8VL4RgSvKdUUU8o3h6n6', 'rh', 'ativo'),
('Carlos (View)', 'view@imec.com.br', '$2a$10$HSMPs0z8tzrFDqVTlugZqOqA7OwOg3sBf8VL4RgSvKdUUU8o3h6n6', 'viewer', 'ativo');

-- Default trainings
INSERT INTO trainings (name, code, category, description, default_workload, default_validity_months, requires_recycling) VALUES
('NR-10 — Segurança em Instalações Elétricas', 'NR-10', 'NR', 'Segurança em instalações e serviços em eletricidade', 40, 24, TRUE),
('NR-11 — Transporte, Movimentação e Armazenagem de Materiais', 'NR-11', 'NR', 'Transporte e movimentação de materiais', 16, 24, TRUE),
('NR-12 — Segurança em Máquinas e Equipamentos', 'NR-12', 'NR', 'Segurança no trabalho com máquinas e equipamentos', 16, 24, TRUE),
('NR-13 — Caldeiras, Vasos de Pressão e Tubulações', 'NR-13', 'NR', 'Segurança em caldeiras, vasos de pressão e tubulações', 40, 24, TRUE),
('NR-18 — Segurança na Construção Civil', 'NR-18', 'NR', 'Segurança e saúde na indústria da construção', 20, 24, TRUE),
('NR-33 — Espaço Confinado', 'NR-33', 'NR', 'Segurança em espaços confinados', 16, 12, TRUE),
('NR-35 — Trabalho em Altura', 'NR-35', 'NR', 'Segurança no trabalho em altura', 8, 24, TRUE),
('Operador de Munck', 'MUNCK', 'Operação', 'Operação de caminhão Munck', 40, 24, TRUE),
('Operador de Guindaste', 'GUINDASTE', 'Operação', 'Operação de guindastes móveis e fixos', 40, 24, TRUE),
('Operador de Ponte Rolante', 'PONTE', 'Operação', 'Operação de ponte rolante', 20, 24, TRUE),
('Operador de Plataforma Elevatória', 'PLATAFORMA', 'Operação', 'Operação de plataforma elevatória veicular', 16, 24, TRUE),
('Soldador', 'SOLDADOR', 'Técnico', 'Treinamento técnico para soldagem', 40, 24, FALSE),
('Caldeireiro', 'CALDEIREIRO', 'Técnico', 'Treinamento técnico para caldeiraria', 40, 24, FALSE),
('Montador de Andaime', 'ANDAIME', 'Técnico', 'Montagem e desmontagem de andaimes', 16, 24, TRUE),
('Trabalho a Quente', 'QUENTE', 'Segurança', 'Permissão para trabalho a quente', 8, 12, TRUE),
('Integração de Segurança', 'INTEG', 'Segurança', 'Integração de segurança admissional', 8, 0, FALSE);

-- Default clients
INSERT INTO clients (name, cnpj, contact_name, phone, email, address, city, state, notes) VALUES
('Clealco Açúcar e Álcool', '12.345.678/0001-90', 'Roberto Clealco', '(16) 3333-1000', 'contato@clealco.com.br', 'Usina Clealco, km 22', 'Cleápolis', 'SP', 'Cliente desde 2020'),
('Companhia Müller de Bebidas', '23.456.789/0001-01', 'Fernanda Müller', '(16) 3444-2000', 'engenharia@muller.com.br', 'Rod. SP-304, km 150', 'Piracicaba', 'SP', ''),
('Usina Santa Adélia', '34.567.890/0001-12', 'José Santos', '(16) 3555-3000', 'manutencao@santaadelia.com.br', 'Usina Santa Adélia s/n', 'Santa Adélia', 'SP', 'Parceiro estratégico');

-- Default employees
INSERT INTO employees (full_name, cpf, rg, birth_date, phone, email, address, role_position, department, admission_date, status, notes) VALUES
('João da Silva Santos', '123.456.789-01', '12.345.678-9', '1988-05-15', '(16) 99999-1234', 'joao@email.com', 'Rua das Flores, 123 - Jaboticabal/SP', 'Operador de Munck', 'Operações', '2020-03-10', 'ativo', 'Funcionário modelo'),
('Carlos Henrique Oliveira', '234.567.890-12', '23.456.789-0', '1992-08-22', '(16) 99888-5678', 'carlos@email.com', 'Av. Brasil, 456 - Sertãozinho/SP', 'Soldador', 'Soldagem', '2021-06-15', 'ativo', ''),
('Pedro Alves Ferreira', '345.678.901-23', '34.567.890-1', '1985-12-03', '(16) 99777-9012', 'pedro@email.com', 'Rua São Paulo, 789 - Ribeirão Preto/SP', 'Montador Industrial', 'Montagem', '2019-01-20', 'ativo', 'Experiência em NR-33');

-- Default equipment
INSERT INTO equipment (name, type, brand, model, serial_number, asset_number, plate, year, capacity, owner, status, notes) VALUES
('MUNCK HINCOL 43.000', 'Caminhão Munck', 'HINCOL', '43.000', 'HN43000-2020', 'EQ-001', 'ABC-1D23', '2020', '43.000 kgf.m', 'IMEC Soluções Industriais', 'ativo', 'Equipamento principal para operações de carga'),
('Guindaste XCMG QY70K', 'Guindaste', 'XCMG', 'QY70K', 'XCMG-QY70K-2019', 'EQ-002', 'DEF-4G56', '2019', '70 toneladas', 'IMEC Soluções Industriais', 'ativo', 'Guindaste telescópico'),
('Guindaste XCMG 110t', 'Guindaste', 'XCMG', 'QY110K', 'XCMG-110K-2021', 'EQ-003', 'GHI-7J89', '2021', '110 toneladas', 'IMEC Soluções Industriais', 'ativo', '');

-- Default projects
INSERT INTO projects (name, client_id, location, start_date, expected_end_date, status, service_description, technical_responsible, notes) VALUES
('Manutenção Caldeira NR-13', 1, 'Usina Clealco - Área Industrial', '2025-07-01', '2025-12-31', 'em_andamento', 'Manutenção preventiva e corretiva em caldeira de alta pressão conforme NR-13', 'Eng. Roberto Silva', 'Projeto prioritário'),
('Plano de Rigging - Montagem Industrial', 2, 'Companhia Müller - Setor de Envase', '2025-08-01', '2025-11-30', 'planejada', 'Elaboração de plano de rigging para movimentação de equipamentos na nova linha de envase', 'Eng. Roberto Silva', ''),
('Operação Guindaste - Trocador de Calor', 3, 'Usina Santa Adélia - Área de Produção', '2025-06-15', '2025-09-30', 'em_andamento', 'Operação com guindaste para substituição de trocador de calor', 'Eng. Roberto Silva', 'Operação crítica');

-- Default system settings
INSERT INTO system_settings (company_name, cnpj, address, email, phone, technical_responsible, crea_number, expiration_alert_days, allow_public_pdf_view, report_footer) VALUES
('IMEC Soluções Industriais', '12.345.678/0001-99', 'Rua Industrial, 1000 - Ribeirão Preto/SP', 'contato@imec.com.br', '(16) 3333-0000', 'Eng. Roberto Silva', '123456/SP', 30, TRUE, 'IMEC Soluções Industriais — Sistema de Gestão de Compliance Industrial v1.0');

-- Default competency requirements
INSERT INTO competency_requirements (activity_name, required_training_ids, requires_aso, requires_epi, requires_client_integration, notes) VALUES
('Trabalho em Altura com Montagem de Andaime', '["7", "5", "14"]', TRUE, TRUE, TRUE, ''),
('Operação de Guindaste', '["9", "2"]', TRUE, TRUE, TRUE, ''),
('Espaço Confinado', '["6"]', TRUE, TRUE, TRUE, ''),
('Soldagem em Geral', '["12", "15"]', TRUE, TRUE, FALSE, '');
