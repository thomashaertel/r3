package types

type FileType struct {
	Builder bool `json:"builder"`

	Db FileTypeDb `json:"db"`

	Paths struct {
		Captions       string `json:"captions"`
		Certificates   string `json:"certificates"`
		EmbeddedDbBin  string `json:"embeddedDbBin"`
		EmbeddedDbData string `json:"embeddedDbData"`
		Files          string `json:"files"`
		Packages       string `json:"packages"`
		Temp           string `json:"temp"`
		Transfer       string `json:"transfer"`
		Web            string `json:"web"`
	} `json:"paths"`

	Web struct {
		Cert   string `json:"cert"`
		Key    string `json:"key"`
		Listen string `json:"listen"`
		Port   int    `json:"port"`
	} `json:"web"`
}

type FileTypeDb struct {
	Embedded bool   `json:"embedded"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Name     string `json:"name"`
	User     string `json:"user"`
	Pass     string `json:"pass"`
}