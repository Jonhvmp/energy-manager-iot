/**
 * Tipos de comandos que podem ser enviados aos dispositivos IoT
 */
export enum CommandType {
  SLEEP = 'sleep',          // Coloca o dispositivo em modo de economia de energia
  WAKE = 'wake',            // Acorda o dispositivo do modo de economia
  RESTART = 'restart',      // Reinicia o dispositivo
  UPDATE = 'update',        // Solicita atualização do firmware
  SET_REPORTING = 'set_reporting_interval', // Define intervalo de relatórios
  GET_STATUS = 'get_status' // Solicita status atual
}

/**
 * Interface para comandos enviados aos dispositivos
 */
export interface DeviceCommand {
  type: CommandType;
  payload?: any;
  timestamp: number;
  requestId?: string;
}

/**
 * Interface para resposta de comando dos dispositivos
 */
export interface CommandResponse {
  success: boolean;
  requestId?: string;
  message?: string;
  timestamp: number;
}
